# Phase 04 — User Management + Permission APIs

## Context Links
- [Phase 02 — Auth Core](phase-02-backend-auth-core.md) — middleware used here
- [Phase 01 — Schema](phase-01-db-schema-and-seed.md) — User/Permission models
- [Brief v4](../../brief-v4.txt) — sections 5, 6, 8, 11

## Overview
- **Priority:** P0
- **Status:** Pending
- **Effort:** 6h
- **Description:** Build user CRUD APIs with tier-scoped access control and permission matrix CRUD. Enforce brief's hierarchy rules: SAdmin > Admin > User. All mutations logged to AuditLog.

## Key Insights
- Tier hierarchy is core security invariant: Admin cannot touch Admin/SAdmin, User cannot touch anyone.
- SAdmin is unique — cannot be created via API, cannot be deleted, role cannot be changed.
- "Không tự nâng quyền": user cannot edit own role or own permission scope.
- Permission updates are per-role (PUT /permissions/:role), not per-user. This is a design decision from the interview.
- Admin editing permissions: can only edit role=USER permissions. SAdmin can edit ADMIN+USER.
- Nobody edits SADMIN permissions (they're always full CRUD on everything).

## Requirements

### Functional

**User endpoints:**
- F1: `GET /api/users` — SAdmin sees all, Admin sees USER-role only, USER blocked (403)
- F2: `GET /api/users/:id` — same scope filter; 404 if out of scope
- F3: `POST /api/users` — create user; SAdmin can set role=ADMIN|USER; Admin can set role=USER only; role=SADMIN always blocked
- F4: `PUT /api/users/:id` — update username only; SAdmin can edit ADMIN+USER; Admin can edit USER only; cannot edit SAdmin; cannot edit self-role
- F5: `PUT /api/users/:id/reset-password` — body: `{ newPassword }`; same tier rules as update
- F6: `PUT /api/users/:id/status` — body: `{ status: 'ACTIVE'|'LOCKED' }`; cannot self-lock; cannot lock SAdmin
- F7: `DELETE /api/users/:id` — cannot self-delete; cannot delete SAdmin; Admin cannot delete ADMIN/SADMIN

**Permission endpoints:**
- F8: `GET /api/permissions` — returns full matrix: all role x module rows; SAdmin+Admin can view; USER blocked
- F9: `PUT /api/permissions/:role` — body: array of `{ module, canView, canCreate, canUpdate, canDelete }`; SAdmin can edit ADMIN+USER; Admin can edit USER only; SADMIN role always blocked

**Audit:**
- F10: All user create/update/delete/status-change/password-reset logged to AuditLog
- F11: All permission updates logged to AuditLog

### Non-functional
- NF1: Consistent error messages in Vietnamese-friendly format (codes, not sentences)
- NF2: Validation: username 3-50 chars alphanumeric+underscore; password 6+ chars

## Architecture

### Tier Enforcement Helper

Create `src/utils/tier-guard.ts`:

```ts
import { UserRole } from '../generated/prisma/index.js';

/** Returns true if actor can manage target role */
export function canManageRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (targetRole === 'SADMIN') return false;          // Nobody manages SAdmin
  if (actorRole === 'SADMIN') return true;             // SAdmin manages all others
  if (actorRole === 'ADMIN' && targetRole === 'USER') return true;
  return false;
}

/** Returns true if actor can edit permissions for targetRole */
export function canEditPermissions(actorRole: UserRole, targetRole: UserRole): boolean {
  if (targetRole === 'SADMIN') return false;
  if (actorRole === 'SADMIN') return true;
  if (actorRole === 'ADMIN' && targetRole === 'USER') return true;
  return false;
}
```

### Data Flow — Create User
```
POST /api/users { username, password, role }
  → requireAuth → requirePermission('users', 'create')
  → validate body (username format, password length, role enum)
  → if role === 'SADMIN' → 403
  → canManageRole(req.user.role, body.role) → false → 403
  → check username unique → conflict → 409
  → hashPassword(body.password)
  → prisma.user.create({ username, passwordHash, role, createdById: req.user.id })
  → logAudit({ actor, action: 'user_create', targetType: 'User', targetId, metadata: { role } })
  → return user (without passwordHash)
```

### Data Flow — Update Permissions
```
PUT /api/permissions/:role { permissions: [{ module, canView, canCreate, canUpdate, canDelete }] }
  → requireAuth → requirePermission('permissions', 'update')
  → validate role param is valid enum
  → canEditPermissions(req.user.role, targetRole) → false → 403
  → for each entry: prisma.permission.upsert({ where: { role_module }, create/update })
  → logAudit({ actor, action: 'permission_update', targetType: 'Permission', metadata: { role, changes } })
  → return updated permission rows
```

### Response Shapes

**User (API response — never expose passwordHash):**
```ts
interface UserResponse {
  id: string;
  username: string;
  role: 'SADMIN' | 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'LOCKED';
  created_at: string;
  updated_at: string;
  created_by: string | null;
}
```

**Permission matrix response:**
```ts
interface PermissionRow {
  role: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}
// GET /api/permissions returns PermissionRow[]
```

## Related Code Files

### Files to Create
- `backend/src/routes/user-routes.ts` — user CRUD endpoints
- `backend/src/routes/permission-routes.ts` — permission matrix endpoints
- `backend/src/utils/tier-guard.ts` — tier enforcement helpers
- `backend/src/utils/user-validation.ts` — username/password validation

### Files to Modify
- `backend/src/index.ts` — mount user-routes and permission-routes (with requireAuth)

### Files to Delete
- None

## Implementation Steps

1. **Create `src/utils/tier-guard.ts`** — `canManageRole()` and `canEditPermissions()` as shown above

2. **Create `src/utils/user-validation.ts`**
   ```ts
   export function validateUsername(username: string): string | null {
     if (!username || username.length < 3 || username.length > 50) return 'Username must be 3-50 characters';
     if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Username must be alphanumeric or underscore';
     return null;
   }
   export function validatePassword(password: string): string | null {
     if (!password || password.length < 6) return 'Password must be at least 6 characters';
     return null;
   }
   ```

3. **Create `src/routes/user-routes.ts`**

   All routes use `requirePermission('users', action)`:

   **GET `/`** (view):
   - SAdmin: `prisma.user.findMany()` (all)
   - ADMIN: `prisma.user.findMany({ where: { role: 'USER' } })`
   - Map results to UserResponse (exclude passwordHash)
   - Optional query param `?role=USER` for filtering

   **GET `/:id`** (view):
   - Fetch user by id
   - Scope check: if req.user.role === 'ADMIN' and target.role !== 'USER' → 404
   - Return UserResponse

   **POST `/`** (create):
   - Validate body: username, password, role
   - Block role=SADMIN always
   - `canManageRole(req.user.role, body.role)` → false → 403
   - Check username uniqueness → 409
   - Hash password, create user with createdById
   - Audit log
   - Return UserResponse (201)

   **PUT `/:id`** (update):
   - Fetch target user
   - Block editing SAdmin
   - `canManageRole(req.user.role, target.role)` → false → 403
   - Only allow updating `username` field
   - Validate username
   - Check uniqueness if changed → 409
   - Update with updatedById
   - Audit log

   **PUT `/:id/reset-password`** (update):
   - Fetch target user
   - `canManageRole(req.user.role, target.role)` → false → 403
   - Validate newPassword
   - Hash and update passwordHash + updatedById
   - Audit log (action: 'user_reset_password')

   **PUT `/:id/status`** (update):
   - Fetch target user
   - Cannot self-lock: `req.user.id === target.id` → 400
   - Cannot lock SAdmin → 403
   - `canManageRole(req.user.role, target.role)` → false → 403
   - Validate status enum
   - Update status + updatedById
   - Audit log (action: 'user_status_change', metadata: { from, to })

   **DELETE `/:id`** (delete):
   - Fetch target user
   - Cannot self-delete: `req.user.id === target.id` → 400
   - Cannot delete SAdmin → 403
   - `canManageRole(req.user.role, target.role)` → false → 403
   - `prisma.user.delete({ where: { id } })`
   - Audit log (action: 'user_delete')

4. **Create `src/routes/permission-routes.ts`**

   **GET `/`** (view):
   - `requirePermission('permissions', 'view')`
   - `prisma.permission.findMany({ orderBy: [{ role: 'asc' }, { module: 'asc' }] })`
   - Map to snake_case response

   **PUT `/:role`** (update):
   - `requirePermission('permissions', 'update')`
   - Validate `:role` is valid UserRole enum value
   - `canEditPermissions(req.user.role, targetRole)` → false → 403
   - Self-elevation check: if `req.user.role === targetRole` → 403 ("Cannot edit own role's permissions")
   - Body: `{ permissions: [{ module, canView, canCreate, canUpdate, canDelete }] }`
   - Validate each module is in allowed list
   - Transaction: upsert each Permission row
   - Audit log with before/after diff in metadata
   - Return updated rows

5. **Modify `src/index.ts`** — add route mounting:
   ```ts
   import userRoutes from './routes/user-routes.js';
   import permissionRoutes from './routes/permission-routes.js';

   app.use('/api/users', requireAuth, userRoutes);
   app.use('/api/permissions', requireAuth, permissionRoutes);
   ```

6. **Type-check**
   ```bash
   cd backend && pnpm run build
   ```

## Todo List

- [ ] Create src/utils/tier-guard.ts
- [ ] Create src/utils/user-validation.ts
- [ ] Create src/routes/user-routes.ts — GET /
- [ ] Create src/routes/user-routes.ts — GET /:id
- [ ] Create src/routes/user-routes.ts — POST /
- [ ] Create src/routes/user-routes.ts — PUT /:id
- [ ] Create src/routes/user-routes.ts — PUT /:id/reset-password
- [ ] Create src/routes/user-routes.ts — PUT /:id/status
- [ ] Create src/routes/user-routes.ts — DELETE /:id
- [ ] Create src/routes/permission-routes.ts — GET /
- [ ] Create src/routes/permission-routes.ts — PUT /:role
- [ ] Mount routes in index.ts
- [ ] Type-check passes
- [ ] Test: Admin cannot create Admin
- [ ] Test: Admin cannot edit SAdmin
- [ ] Test: User cannot access /api/users
- [ ] Test: Self-elevation blocked
- [ ] Test: Self-delete blocked
- [ ] Test: Audit log entries created

## Success Criteria
- SAdmin can CRUD all Admin+User accounts
- Admin can CRUD User accounts only; blocked on Admin/SAdmin
- USER gets 403 on all /api/users/* and /api/permissions/*
- Cannot create role=SADMIN via API
- Cannot delete SAdmin via API
- Cannot edit own role's permissions
- Cannot self-lock or self-delete
- All mutations produce AuditLog entries
- `pnpm run build` passes

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Tier bypass via direct API call | Medium | Critical | canManageRole checked server-side on every mutation |
| Self-elevation via permission edit | Medium | Critical | Explicit self-role check before permission upsert |
| Race condition on username uniqueness | Low | Low | DB unique constraint catches; API returns 409 |
| Orphaned records when user deleted | Low | Medium | onDelete:SetNull on created_by/updated_by FKs |

## Security Considerations
- passwordHash NEVER returned in any API response — strip in all response mappers
- Tier guard is defense-in-depth: permission middleware blocks USER from /api/users, tier guard blocks Admin from Admin/SAdmin
- Username validation prevents injection (alphanumeric + underscore only)
- Password hashed with bcrypt cost 12 before storage
- Audit log captures actor, target, action, IP, metadata for full forensic trail
- Self-elevation prevention: cannot change own role, cannot edit permissions for own role tier

## Next Steps
- Phase 05 builds frontend auth context that consumes login/me/permissions responses
- Phase 06 builds frontend pages for user management using these APIs
- Phase 07 builds frontend permission dashboard using GET/PUT /api/permissions

# Phase 08 — Audit Log Viewer + Polish + Docs

## Context Links
- [Phase 01 — Schema](phase-01-db-schema-and-seed.md) — AuditLog model
- [Phase 02 — Auth Core](phase-02-backend-auth-core.md) — audit-logger.ts utility
- [CLAUDE.md](../../CLAUDE.md) — project docs to update
- [Plan overview](plan.md)

## Overview
- **Priority:** P2
- **Status:** Pending
- **Effort:** 4h
- **Description:** Expose read-only audit log viewer (SAdmin only). Update all project documentation with auth flow, env vars, API endpoints, deployment instructions.

## Key Insights
- Audit log is read-only — no create/update/delete from API. Only SAdmin can view.
- AuditLog rows already created by phases 02-04 (login, user CRUD, permission changes).
- Pagination needed — audit logs grow over time. Simple offset/limit.
- Docs update is critical for deployment — new env vars (JWT_SECRET, SADMIN_USERNAME, SADMIN_PASSWORD) must be documented.

## Requirements

### Functional

**Backend:**
- F1: `GET /api/audit-logs` — paginated list, SAdmin only
- F2: Query params: `page` (default 1), `limit` (default 50), `action` (filter), `actorUserId` (filter), `from`/`to` (date range)
- F3: Response includes total count for frontend pagination

**Frontend:**
- F4: `/audit-logs` page — table: timestamp, actor username, action, target, IP
- F5: Filters: action type dropdown, date range picker (optional — simple text inputs for from/to dates)
- F6: Pagination controls
- F7: Nav item "Nhật ký" visible only to SAdmin (check role directly, not permission-based)

**Docs:**
- F8: Update CLAUDE.md + .github/copilot-instructions.md with auth system docs
- F9: Update .env.example with new env vars
- F10: Smoke-test checklist

### Non-functional
- NF1: Audit log table sorted by created_at DESC (newest first)
- NF2: Limit max 100 per page to prevent memory issues

## Architecture

### Backend Endpoint

```ts
// GET /api/audit-logs?page=1&limit=50&action=login_success&from=2026-04-01&to=2026-04-15
// Response:
{
  data: AuditLogEntry[],
  total: number,
  page: number,
  limit: number
}

interface AuditLogEntry {
  id: string;
  actor_username: string | null;  // joined from User
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}
```

Route protection: `requireAuth` + inline role check (`req.user.role !== 'SADMIN' → 403`). No permission table check — audit log is SAdmin-exclusive by design, not configurable.

### Frontend Page

Simple table + filter bar:
```
Audit Log
┌────────────────────────────────────────────────────────────────┐
│ Action: [All ▼]  From: [____]  To: [____]  [Lọc]             │
├────────────────────────────────────────────────────────────────┤
│ Thời gian          │ Người thực hiện │ Hành động │ Đối tượng  │
│ 2026-04-15 10:30   │ admin           │ login_ok  │ —          │
│ 2026-04-15 10:28   │ admin           │ user_cre  │ User:abc   │
│ ...                                                            │
├────────────────────────────────────────────────────────────────┤
│ ◀ Trang 1 / 5 ▶                                               │
└────────────────────────────────────────────────────────────────┘
```

### Action Types (for filter dropdown)
```ts
const AUDIT_ACTIONS = [
  { value: 'login_success', label: 'Đăng nhập thành công' },
  { value: 'login_fail', label: 'Đăng nhập thất bại' },
  { value: 'user_create', label: 'Tạo tài khoản' },
  { value: 'user_update', label: 'Sửa tài khoản' },
  { value: 'user_delete', label: 'Xóa tài khoản' },
  { value: 'user_reset_password', label: 'Reset mật khẩu' },
  { value: 'user_status_change', label: 'Đổi trạng thái' },
  { value: 'password_change', label: 'Đổi mật khẩu' },
  { value: 'permission_update', label: 'Cập nhật quyền' },
];
```

## Related Code Files

### Files to Create
- `backend/src/routes/audit-log-routes.ts` — GET /api/audit-logs
- `frontend/src/api/audit-log-api.ts` — API client
- `frontend/src/pages/audit-log-page.tsx` — audit log viewer

### Files to Modify
- `backend/src/index.ts` — mount audit-log-routes (with requireAuth)
- `frontend/src/App.tsx` — add /audit-logs route
- `frontend/src/components/app-layout.tsx` — add "Nhật ký" nav item (SAdmin only)
- `CLAUDE.md` — document auth system, new env vars, new endpoints
- `.github/copilot-instructions.md` — sync with CLAUDE.md
- `.env.example` (or root `.env.example`) — add JWT_SECRET, SADMIN_USERNAME, SADMIN_PASSWORD, JWT_EXPIRES_IN

### Files to Delete
- None

## Implementation Steps

### Backend

1. **Create `src/routes/audit-log-routes.ts`**
   ```ts
   import { Router, type Request, type Response } from 'express';
   import prisma from '../lib/prisma-client.js';

   const router: ReturnType<typeof Router> = Router();

   router.get('/', async (req: Request, res: Response) => {
     // SAdmin-only check
     if (req.user?.role !== 'SADMIN') {
       return res.status(403).json({ error: 'Forbidden' });
     }

     const page = Math.max(1, parseInt(req.query.page as string) || 1);
     const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
     const skip = (page - 1) * limit;

     const where: Record<string, unknown> = {};
     if (req.query.action) where.action = req.query.action as string;
     if (req.query.actorUserId) where.actorUserId = req.query.actorUserId as string;
     if (req.query.from || req.query.to) {
       where.createdAt = {};
       if (req.query.from) (where.createdAt as Record<string, unknown>).gte = new Date(req.query.from as string);
       if (req.query.to) (where.createdAt as Record<string, unknown>).lte = new Date(req.query.to as string);
     }

     const [data, total] = await Promise.all([
       prisma.auditLog.findMany({
         where,
         include: { actor: { select: { username: true } } },
         orderBy: { createdAt: 'desc' },
         skip,
         take: limit,
       }),
       prisma.auditLog.count({ where }),
     ]);

     // Map to response
     res.json({
       data: data.map(row => ({
         id: row.id,
         actor_username: row.actor?.username ?? null,
         action: row.action,
         target_type: row.targetType,
         target_id: row.targetId,
         metadata: row.metadata,
         ip: row.ip,
         created_at: row.createdAt.toISOString(),
       })),
       total,
       page,
       limit,
     });
   });

   export default router;
   ```

2. **Modify `src/index.ts`** — mount route:
   ```ts
   import auditLogRoutes from './routes/audit-log-routes.js';
   app.use('/api/audit-logs', requireAuth, auditLogRoutes);
   ```

### Frontend

3. **Create `src/api/audit-log-api.ts`**
   ```ts
   import api from './api-client';

   export interface AuditLogEntry { ... }
   export interface AuditLogResponse { data: AuditLogEntry[]; total: number; page: number; limit: number; }

   export const getAuditLogs = (params?: Record<string, string>): Promise<AuditLogResponse> =>
     api.get('/audit-logs', { params }).then(r => r.data);
   ```

4. **Create `src/pages/audit-log-page.tsx`**
   - Filter bar: action dropdown + from/to date inputs + "Lọc" button
   - Table: timestamp, actor, action, target_type:target_id, IP
   - Pagination: prev/next buttons + page indicator
   - Metadata column: expandable JSON (or tooltip) — keep simple, maybe just hidden

5. **Modify `src/App.tsx`** — add route:
   ```tsx
   <Route path="/audit-logs" element={<AuditLogPage />} />
   ```

6. **Modify `src/components/app-layout.tsx`** — add nav item:
   - "Nhật ký" with clipboard/log icon
   - Visibility: `user.role === 'SADMIN'` (not permission-based — audit log is inherently SAdmin-only)

### Documentation

7. **Update `CLAUDE.md`** — add/modify sections:
   - **Auth System** section: JWT cookie flow, roles, middleware chain
   - **API Endpoints** table: add /api/auth/*, /api/users/*, /api/permissions/*, /api/audit-logs
   - **Environment Variables** table: add JWT_SECRET (required), JWT_EXPIRES_IN (default 7d), SADMIN_USERNAME (required), SADMIN_PASSWORD (required)
   - **Project Structure**: add new files (middleware/, auth-routes, user-routes, permission-routes, audit-log-routes, frontend auth context/pages)

8. **Update `.github/copilot-instructions.md`** — sync with CLAUDE.md changes

9. **Update `.env.example`** — add:
   ```
   JWT_SECRET=your-secret-key-min-32-chars
   JWT_EXPIRES_IN=7d
   SADMIN_USERNAME=admin
   SADMIN_PASSWORD=change-me-in-production
   ```

10. **Type-check both**
    ```bash
    cd backend && pnpm run build
    cd frontend && npx tsc --noEmit
    ```

### Smoke Test Checklist

11. **End-to-end verification** (manual):
    - [ ] Fresh start: `docker compose up --build` with env vars set
    - [ ] Login as SAdmin with SADMIN_USERNAME/SADMIN_PASSWORD
    - [ ] Verify /devices, /locations pages work as before
    - [ ] Create Admin user, create User account
    - [ ] Logout → login as Admin → verify scoped access (sees USER only in /users)
    - [ ] Admin edits USER permissions in /permissions dashboard
    - [ ] Logout → login as User → verify restricted view (hidden nav items, hidden buttons)
    - [ ] User attempts direct API call to /api/users → 403
    - [ ] SAdmin views /audit-logs → sees all login+CRUD events
    - [ ] Change password flow works for each role
    - [ ] Lock user → user cannot login
    - [ ] Delete user → user removed from list
    - [ ] Public device page (/public/device/:id) still works without auth

## Todo List

- [ ] Create backend audit-log-routes.ts
- [ ] Mount audit-log-routes in index.ts
- [ ] Create frontend audit-log-api.ts
- [ ] Create frontend audit-log-page.tsx
- [ ] Add /audit-logs route to App.tsx
- [ ] Add "Nhật ký" nav item (SAdmin only)
- [ ] Update CLAUDE.md — auth system docs
- [ ] Update .github/copilot-instructions.md — sync
- [ ] Update .env.example — new env vars
- [ ] Backend type-check passes
- [ ] Frontend type-check passes
- [ ] Run smoke test checklist

## Success Criteria
- SAdmin can view paginated audit log with filters
- Non-SAdmin users get 403 on /api/audit-logs
- Audit log shows all events from phases 02-04 (login, user CRUD, permission changes)
- CLAUDE.md accurately documents the full auth system
- .env.example contains all required env vars
- Fresh docker deployment with env vars → SAdmin can login → full flow works
- All type-checks pass

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Audit log table grows unbounded | Medium | Low | Pagination limits query size; future: add retention policy if needed |
| CLAUDE.md sync drift with copilot-instructions.md | Medium | Low | Update both in same commit; grep for differences |
| Missing env vars in production | Medium | High | Startup validation (JWT_SECRET check in phase 02); document clearly |

## Security Considerations
- Audit log is read-only — no delete/update API exposed
- SAdmin-only access hardcoded (not configurable via permission dashboard)
- Audit log metadata may contain usernames but never passwords
- IP logging via `req.ip` — useful for forensics
- JWT_SECRET documented as required with minimum length guidance

## Next Steps
- This is the final phase. After completion:
  - Run full smoke test
  - Create PR from `feat/rbac-auth-system` to `main`
  - Update project roadmap and changelog in `docs/`

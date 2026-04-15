# Phase 06 — Frontend User Management Pages

## Context Links
- [Phase 04 — User APIs](phase-04-user-and-permission-apis.md) — backend endpoints
- [Phase 05 — Frontend Auth](phase-05-frontend-auth-and-guards.md) — auth context, useCan, RequirePermission
- [Current app-layout.tsx](../../frontend/src/components/app-layout.tsx) — sidebar nav pattern
- [Current device-list-page.tsx](../../frontend/src/pages/device-list-page.tsx) — table pattern reference

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 5h
- **Description:** Build user management frontend: user list, create/edit user, reset password, lock/unlock, delete. Scoped by role — SAdmin sees all, Admin sees USER only.

## Key Insights
- Follow existing UI patterns: table layout from device-list-page, form layout from device-create-page.
- SAdmin sees all users; Admin sees USER-role users only — backend already filters, frontend just renders.
- Role selector: SAdmin sees ADMIN+USER options; Admin sees USER only. Never show SADMIN option.
- Status toggle (ACTIVE/LOCKED) is a button action, not a full form page.
- Reset password is a modal/inline form, not a separate page.
- Delete requires confirmation dialog.

## Requirements

### Functional
- F1: User list page at `/users` — table with columns: username, role, status, created_at, actions
- F2: Create user page/modal — form: username, password, role selector
- F3: Edit user page/modal — form: username only (role not editable after creation per brief simplicity)
- F4: Reset password action — modal with new password + confirm fields
- F5: Lock/unlock toggle — button with confirmation
- F6: Delete user — button with confirmation dialog
- F7: All actions respect tier rules (frontend hides buttons backend would reject)
- F8: Nav item "Tài khoản" visible only if `useCan('users', 'view')`

### Non-functional
- NF1: Consistent styling with existing pages (Tailwind, indigo-600 accent, slate backgrounds)
- NF2: Responsive — table scrolls on mobile
- NF3: Loading states on all async operations
- NF4: Error handling with user-friendly Vietnamese messages

## Architecture

### Page Structure
```
/users              → UsersListPage (table + action buttons)
/users/new          → UserFormPage (create mode)
/users/:id/edit     → UserFormPage (edit mode)
```

Reset password and lock/unlock are modal dialogs triggered from the list page or detail context.

### Component Tree
```
UsersListPage
  ├── Table (username, role badge, status badge, created_at, actions)
  ├── Action buttons per row:
  │   ├── Edit (→ /users/:id/edit)
  │   ├── Reset Password (opens modal)
  │   ├── Lock/Unlock (inline confirm)
  │   └── Delete (confirm dialog)
  └── "Thêm tài khoản" button (→ /users/new)

UserFormPage
  ├── Username input
  ├── Password input (create only)
  ├── Role selector (create only; SAdmin: ADMIN|USER, Admin: USER)
  └── Submit / Cancel
```

### API Client Shape
```ts
// frontend/src/api/user-api.ts
export interface UserItem {
  id: string;
  username: string;
  role: 'SADMIN' | 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'LOCKED';
  created_at: string;
  updated_at: string;
}

export const getUsers: () => Promise<UserItem[]>;
export const getUser: (id: string) => Promise<UserItem>;
export const createUser: (data: { username: string; password: string; role: string }) => Promise<UserItem>;
export const updateUser: (id: string, data: { username: string }) => Promise<UserItem>;
export const resetUserPassword: (id: string, data: { newPassword: string }) => Promise<void>;
export const updateUserStatus: (id: string, data: { status: string }) => Promise<UserItem>;
export const deleteUser: (id: string) => Promise<void>;
```

## Related Code Files

### Files to Create
- `frontend/src/api/user-api.ts` — axios client for /api/users/*
- `frontend/src/pages/users-list-page.tsx` — user list with actions
- `frontend/src/pages/user-form-page.tsx` — create + edit form
- `frontend/src/components/reset-password-modal.tsx` — reset password dialog
- `frontend/src/components/confirm-dialog.tsx` — reusable confirm dialog (delete, lock/unlock)

### Files to Modify
- `frontend/src/App.tsx` — add /users, /users/new, /users/:id/edit routes
- `frontend/src/components/app-layout.tsx` — add "Tài khoản" nav item (gated by useCan)

### Files to Delete
- None

## Implementation Steps

1. **Create `src/api/user-api.ts`**
   - Import shared axios instance from device-api.ts (or create shared instance — but KISS: just create another with same config)
   - Actually: extract a shared `api` instance to avoid duplication. BUT device-api.ts already exports `api` implicitly. Simplest: import same pattern.
   ```ts
   import axios from 'axios';
   const api = axios.create({ baseURL: '/api', withCredentials: true });
   // Add same 401 interceptor as device-api.ts
   ```
   Note: DRY concern — two axios instances with same config. Consider extracting to `src/api/api-client.ts` in this phase:
   ```ts
   // src/api/api-client.ts
   import axios from 'axios';
   const api = axios.create({ baseURL: '/api', withCredentials: true });
   api.interceptors.response.use(res => res, err => {
     if (err.response?.status === 401) window.location.href = '/login';
     return Promise.reject(err);
   });
   export default api;
   ```
   Then refactor device-api.ts and auth-api.ts to import from api-client.ts. Do this refactor here.

2. **Create `src/api/api-client.ts`** — shared axios instance (DRY refactor)

3. **Refactor `src/api/device-api.ts`** — import `api` from `./api-client` instead of creating its own

4. **Refactor `src/api/auth-api.ts`** — import `api` from `./api-client`, adjust baseURL in calls to include `/auth` prefix

5. **Create `src/api/user-api.ts`** — all user endpoints using shared api instance

6. **Create `src/components/confirm-dialog.tsx`**
   - Props: `isOpen`, `title`, `message`, `confirmLabel`, `onConfirm`, `onCancel`, `variant?: 'danger' | 'warning'`
   - Simple modal overlay with confirm/cancel buttons
   - Reusable for delete + lock/unlock + future use

7. **Create `src/components/reset-password-modal.tsx`**
   - Props: `isOpen`, `userId`, `username`, `onClose`, `onSuccess`
   - Form: new password + confirm password
   - Client validation: match + min 6 chars
   - Submit calls `resetUserPassword(userId, { newPassword })`
   - Success → onSuccess callback + close

8. **Create `src/pages/users-list-page.tsx`**
   - Fetch users on mount via `getUsers()`
   - Table columns: Username, Role (badge: indigo for SADMIN, blue for ADMIN, gray for USER), Status (green ACTIVE / red LOCKED), Created, Actions
   - Actions per row (conditionally rendered):
     - Edit button → navigate to /users/:id/edit (hide if can't update OR if target is SAdmin)
     - Reset Password button → open ResetPasswordModal (same visibility rules)
     - Lock/Unlock button → open ConfirmDialog → call updateUserStatus (hide for SAdmin, hide self)
     - Delete button → open ConfirmDialog → call deleteUser (hide for SAdmin, hide self)
   - "Thêm tài khoản" button at top-right (RequirePermission module="users" action="create")
   - Empty state if no users

9. **Create `src/pages/user-form-page.tsx`**
   - Determine mode from URL: `/users/new` = create, `/users/:id/edit` = edit
   - Create mode: username + password + role selector
   - Edit mode: username only (fetch existing user, pre-fill)
   - Role selector options:
     - If current user is SADMIN: `[{ value: 'ADMIN', label: 'Admin' }, { value: 'USER', label: 'User' }]`
     - If current user is ADMIN: `[{ value: 'USER', label: 'User' }]`
   - Submit: create or update, then navigate back to /users
   - Error handling: 409 → "Tên đăng nhập đã tồn tại"

10. **Modify `src/App.tsx`** — add routes inside ProtectedRoute > AdminLayout:
    ```tsx
    <Route path="/users" element={<UsersListPage />} />
    <Route path="/users/new" element={<UserFormPage />} />
    <Route path="/users/:id/edit" element={<UserFormPage />} />
    ```

11. **Modify `src/components/app-layout.tsx`** — add nav item:
    ```ts
    // In navItems array, add conditionally:
    {
      label: 'Tài khoản',
      path: '/users',
      icon: /* user icon SVG */,
      module: 'users'  // used for permission filtering
    }
    ```
    Filter navItems: `navItems.filter(item => !item.module || useCan(item.module, 'view'))`

12. **Type-check**
    ```bash
    cd frontend && npx tsc --noEmit
    ```

## Todo List

- [ ] Create src/api/api-client.ts (shared axios instance)
- [ ] Refactor device-api.ts to use shared api-client
- [ ] Refactor auth-api.ts to use shared api-client
- [ ] Create src/api/user-api.ts
- [ ] Create src/components/confirm-dialog.tsx
- [ ] Create src/components/reset-password-modal.tsx
- [ ] Create src/pages/users-list-page.tsx
- [ ] Create src/pages/user-form-page.tsx
- [ ] Add user routes to App.tsx
- [ ] Add "Tài khoản" nav item to app-layout.tsx
- [ ] Type-check passes
- [ ] Test: SAdmin sees all users, can CRUD
- [ ] Test: Admin sees USER only, can CRUD USER
- [ ] Test: USER cannot see /users nav item

## Success Criteria
- /users page shows user table scoped by role
- Create user form works with role selection
- Edit user updates username
- Reset password modal works end-to-end
- Lock/unlock toggles user status with confirmation
- Delete user with confirmation
- SAdmin actions available on ADMIN+USER rows
- Admin actions available on USER rows only
- No actions on SAdmin row (except for SAdmin viewing own info)
- Nav item hidden for USER role
- `npx tsc --noEmit` passes

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Shared api-client refactor breaks imports | Medium | Medium | Careful find-replace; type-check catches missing imports |
| Role badge colors clash with status badges | Low | Low | Use distinct color families (blue/gray for role, green/red for status) |
| Large list performance | Low | Low | Pagination YAGNI for now — user count is small in this app |

## Security Considerations
- Frontend hides actions user can't perform, but backend enforces independently
- Password fields use `type="password"` and are never stored in component state after submission
- confirm-dialog prevents accidental destructive actions
- SAdmin row gets no action buttons (except from SAdmin themselves — limited to view)

## Next Steps
- Phase 07: permission dashboard (separate page, different data shape)
- The shared api-client.ts created here will be reused by permission-api.ts

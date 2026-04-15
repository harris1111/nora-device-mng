# Phase 07 — Frontend Permission Dashboard

## Context Links
- [Phase 04 — Permission APIs](phase-04-user-and-permission-apis.md) — GET/PUT /api/permissions
- [Phase 05 — Frontend Auth](phase-05-frontend-auth-and-guards.md) — auth context, useCan
- [Brief v4](../../brief-v4.txt) — sections 6, 9

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 4h
- **Description:** Build permission dashboard page: matrix grid showing CRUD toggles per module per role. SAdmin can edit ADMIN+USER rows. Admin can edit USER rows only. SADMIN row is read-only always.

## Key Insights
- Permission data is flat: `Permission[]` with `{ role, module, canView, canCreate, canUpdate, canDelete }`.
- UI is a matrix: rows = modules, columns = CRUD actions. One tab (or section) per role.
- Editing is toggle-based (checkboxes), saved per role via `PUT /api/permissions/:role`.
- SADMIN permissions are always full — displayed read-only, checkboxes disabled.
- Admin can only edit USER role tab. ADMIN tab is read-only for Admin users.
- Brief says dashboard is accessible to SAdmin + Admin (users with `permissions.view`).

## Requirements

### Functional
- F1: Page at `/permissions` showing permission matrix
- F2: Tab or section per role: SADMIN (read-only), ADMIN (editable by SAdmin), USER (editable by SAdmin+Admin)
- F3: Matrix grid: rows = 7 modules, columns = View/Create/Update/Delete checkboxes
- F4: Save button per role tab — calls `PUT /api/permissions/:role` with toggled values
- F5: Visual feedback: disabled checkboxes for read-only roles, save success/error toast
- F6: Nav item "Phân quyền" visible only if `useCan('permissions', 'view')`

### Non-functional
- NF1: Consistent Tailwind styling with rest of app
- NF2: Optimistic UI not needed — simple save button workflow
- NF3: Module names displayed in Vietnamese labels

## Architecture

### UI Layout
```
Permission Dashboard
┌─────────────────────────────────────────────────────┐
│  [SAdmin ▼]  [Admin ▼]  [User ▼]    ← role tabs    │
├─────────────────────────────────────────────────────┤
│  Module          │ View │ Create │ Update │ Delete  │
│  ─────────────── │ ──── │ ────── │ ────── │ ──────  │
│  Thiết bị        │  ☑   │   ☑    │   ☑    │   ☑    │
│  Đơn vị          │  ☑   │   ☑    │   ☑    │   ☑    │
│  Bảo trì         │  ☑   │   ☑    │   ☑    │   ☑    │
│  Tệp đính kèm   │  ☑   │   ☑    │   ☑    │   ☑    │
│  Luân chuyển     │  ☑   │   ☑    │   ☑    │   ☑    │
│  Tài khoản       │  ☑   │   ☑    │   ☑    │   ☑    │
│  Phân quyền      │  ☑   │   ☐    │   ☑    │   ☐    │
├─────────────────────────────────────────────────────┤
│                                    [Lưu thay đổi]  │
└─────────────────────────────────────────────────────┘
```

### Module Label Map
```ts
const MODULE_LABELS: Record<string, string> = {
  devices: 'Thiết bị',
  locations: 'Đơn vị',
  maintenance: 'Bảo trì',
  attachments: 'Tệp đính kèm',
  transfer: 'Luân chuyển',
  users: 'Tài khoản',
  permissions: 'Phân quyền',
};
```

### Editability Rules
```
Current user = SADMIN:
  SADMIN tab → read-only (cannot edit own role's permissions)
  ADMIN tab  → editable
  USER tab   → editable

Current user = ADMIN:
  SADMIN tab → read-only (or hidden)
  ADMIN tab  → read-only
  USER tab   → editable

Current user = USER:
  → cannot access page (gated by permissions.view)
```

### Data Flow
```
Mount → GET /api/permissions → PermissionRow[]
  → group by role → { SADMIN: [...], ADMIN: [...], USER: [...] }
  → render active tab

Edit checkbox → local state update (dirty tracking)

Save → PUT /api/permissions/:role { permissions: [...modified rows...] }
  → success → refresh data
  → error → show message
```

## Related Code Files

### Files to Create
- `frontend/src/api/permission-api.ts` — getPermissions, updateRolePermissions
- `frontend/src/pages/permission-dashboard-page.tsx` — main dashboard page

### Files to Modify
- `frontend/src/App.tsx` — add /permissions route
- `frontend/src/components/app-layout.tsx` — add "Phân quyền" nav item

### Files to Delete
- None

## Implementation Steps

1. **Create `src/api/permission-api.ts`**
   ```ts
   import api from './api-client';

   export interface PermissionRow {
     role: string;
     module: string;
     can_view: boolean;
     can_create: boolean;
     can_update: boolean;
     can_delete: boolean;
   }

   export interface PermissionUpdate {
     module: string;
     canView: boolean;
     canCreate: boolean;
     canUpdate: boolean;
     canDelete: boolean;
   }

   export const getPermissions = (): Promise<PermissionRow[]> =>
     api.get('/permissions').then(r => r.data);

   export const updateRolePermissions = (role: string, permissions: PermissionUpdate[]) =>
     api.put(`/permissions/${role}`, { permissions }).then(r => r.data);
   ```

2. **Create `src/pages/permission-dashboard-page.tsx`**

   Component structure:
   ```tsx
   export default function PermissionDashboardPage() {
     const { user } = useAuth();
     const [permissions, setPermissions] = useState<PermissionRow[]>([]);
     const [activeRole, setActiveRole] = useState<string>('USER');
     const [editState, setEditState] = useState<Record<string, PermissionUpdate>>({});
     const [isDirty, setIsDirty] = useState(false);
     const [saving, setSaving] = useState(false);

     // Fetch on mount
     // Group by role
     // Determine which tabs are editable

     return (
       <div>
         {/* Role tabs */}
         {/* Permission matrix table */}
         {/* Save button (if editable) */}
       </div>
     );
   }
   ```

   Key logic:
   - **Tab rendering**: show all 3 role tabs. Visually indicate editable vs read-only.
   - **Checkbox onChange**: update local editState, set isDirty=true.
   - **isEditable(role)**: returns true if current user can edit this role's permissions per rules above.
   - **Save handler**: call `updateRolePermissions(activeRole, Object.values(editState))`, then refetch.
   - **Dirty tracking**: warn before switching tabs if unsaved changes (simple confirm).

   Styling:
   - Role tabs: horizontal tab bar (similar to existing UI patterns)
   - Table: `<table>` with Tailwind classes matching device-list-page table style
   - Checkboxes: `accent-indigo-600` for brand consistency
   - Disabled checkboxes: `opacity-50 cursor-not-allowed`
   - Save button: indigo primary button, disabled when !isDirty or saving

3. **Modify `src/App.tsx`** — add route:
   ```tsx
   <Route path="/permissions" element={<PermissionDashboardPage />} />
   ```

4. **Modify `src/components/app-layout.tsx`** — add nav item:
   ```ts
   {
     label: 'Phân quyền',
     path: '/permissions',
     icon: /* shield/key icon SVG */,
     module: 'permissions'
   }
   ```

5. **Type-check**
   ```bash
   cd frontend && npx tsc --noEmit
   ```

## Todo List

- [ ] Create src/api/permission-api.ts
- [ ] Create src/pages/permission-dashboard-page.tsx — tab UI
- [ ] Implement permission matrix table with checkboxes
- [ ] Implement editability rules per role tab
- [ ] Implement save handler with PUT /api/permissions/:role
- [ ] Implement dirty tracking + tab switch warning
- [ ] Add /permissions route to App.tsx
- [ ] Add "Phân quyền" nav item to app-layout.tsx
- [ ] Type-check passes
- [ ] Test: SAdmin can edit ADMIN+USER tabs, SADMIN tab read-only
- [ ] Test: Admin can edit USER tab only
- [ ] Test: Save persists changes (verify via API)

## Success Criteria
- Permission dashboard shows matrix for all 3 roles
- SADMIN tab always read-only (checkboxes disabled)
- SAdmin user can toggle ADMIN+USER permissions and save
- Admin user can toggle USER permissions and save; ADMIN tab read-only
- USER role cannot access page (nav item hidden, route redirects)
- Save success shows feedback
- Dirty state tracked — unsaved changes warned on tab switch
- `npx tsc --noEmit` passes

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Checkbox state management complexity | Medium | Low | Simple Record<module, PermissionUpdate> keyed by module name |
| Permission changes don't reflect until re-login | Medium | Medium | Acceptable — permissions are cached per session. Document this behavior. |
| Module list mismatch frontend vs backend | Low | Medium | Single MODULE_LABELS constant; backend validates module names |

## Security Considerations
- Page gated by `permissions.view` permission — USER cannot access
- Edit capability gated by `permissions.update` + tier rules (canEditPermissions)
- Backend re-validates on PUT — frontend is UX only
- Self-elevation prevented: cannot edit own role's permission tab (enforced backend)

## Next Steps
- Phase 08: audit log viewer + docs update

# Phase 05 — Frontend Auth + Guards

## Context Links
- [Phase 02 — Auth Core](phase-02-backend-auth-core.md) — backend auth API shapes
- [Current App.tsx](../../frontend/src/App.tsx) — router structure
- [Current app-layout.tsx](../../frontend/src/components/app-layout.tsx) — sidebar/nav
- [Current device-api.ts](../../frontend/src/api/device-api.ts) — axios instance

## Overview
- **Priority:** P0
- **Status:** Pending
- **Effort:** 6h
- **Description:** Add login page, auth context (user+permissions), route guards, permission-based UI visibility, and axios interceptors for 401/403 handling. Cookie-based — no token storage in JS.

## Key Insights
- Auth is cookie-based (httpOnly) — frontend never touches the JWT directly. Axios just needs `withCredentials: true`.
- On app mount, call `GET /api/auth/me` to hydrate auth state. If 401 → redirect to /login.
- Permission map shape from backend: `{ [module]: { view, create, update, delete } }` — store in context.
- Frontend guards are UX only — backend is source of truth. Hide buttons/routes user can't use.
- Existing axios instance in device-api.ts: `axios.create({ baseURL: '/api' })`. Must add `withCredentials: true`.
- Vite proxy handles cookie forwarding to backend in dev — no CORS issue.

## Requirements

### Functional
- F1: Login page with username/password form
- F2: Auth context providing: user object, permissions map, isAuthenticated, isLoading, login(), logout()
- F3: Protected route wrapper redirecting unauthenticated users to /login
- F4: Permission-based component wrapper: `<RequirePermission module="devices" action="create">` — renders children or nothing
- F5: `useCan(module, action)` hook for inline permission checks
- F6: Axios interceptor: 401 → clear auth state + redirect /login; 403 → toast/alert "Không có quyền"
- F7: Change password page (authenticated)
- F8: Sidebar nav: hide links user can't view (e.g., hide "Đơn vị" if no locations.view)
- F9: Existing CRUD buttons on device/location/maintenance pages: wrap in RequirePermission

### Non-functional
- NF1: Auth state hydrated before any protected content renders (loading spinner)
- NF2: Login form validates non-empty fields client-side before submit
- NF3: No flash of protected content before auth check completes

## Architecture

### Auth Context Shape
```ts
interface AuthUser {
  id: string;
  username: string;
  role: 'SADMIN' | 'ADMIN' | 'USER';
  status: string;
}

interface PermissionMap {
  [module: string]: {
    view: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
  };
}

interface AuthContextValue {
  user: AuthUser | null;
  permissions: PermissionMap;
  isAuthenticated: boolean;
  isLoading: boolean;               // true during initial /me call
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
```

### Component Tree
```
<BrowserRouter>
  <AuthProvider>                          // calls /me on mount
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/public/*" ... />      // unprotected

      <Route element={<ProtectedRoute />}>    // redirects to /login if !isAuthenticated
        <Route element={<AdminLayout />}>
          <Route path="/devices" ... />
          <Route path="/locations" ... />
          <Route path="/users" ... />           // Phase 06
          <Route path="/permissions" ... />     // Phase 07
          <Route path="/audit-logs" ... />      // Phase 08
        </Route>
      </Route>
    </Routes>
  </AuthProvider>
</BrowserRouter>
```

### Axios Setup
```ts
// In device-api.ts (or a shared api-client.ts):
const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      window.location.href = '/login';    // hard redirect — clears SPA state
    }
    return Promise.reject(err);
  }
);
```

Consideration: instead of hard redirect on 401, could dispatch to auth context. But hard redirect is simpler and guarantees clean state. Use this approach.

### Permission Check Flow
```
useCan('devices', 'create')
  → reads permissions from AuthContext
  → returns permissions['devices']?.create ?? false
```

## Related Code Files

### Files to Create
- `frontend/src/api/auth-api.ts` — login, logout, me API calls
- `frontend/src/context/auth-context.tsx` — AuthProvider + useAuth hook
- `frontend/src/hooks/use-permission.ts` — useCan(module, action) hook
- `frontend/src/components/protected-route.tsx` — auth guard wrapper
- `frontend/src/components/require-permission.tsx` — conditional render by permission
- `frontend/src/pages/login-page.tsx` — login form

### Files to Modify
- `frontend/src/api/device-api.ts` — add `withCredentials: true` to axios instance; add 401 interceptor
- `frontend/src/App.tsx` — wrap with AuthProvider, add ProtectedRoute, add login route
- `frontend/src/components/app-layout.tsx` — permission-filtered nav items, user display, logout button

### Files to Delete
- None

## Implementation Steps

1. **Create `src/api/auth-api.ts`**
   ```ts
   import axios from 'axios';
   const api = axios.create({ baseURL: '/api/auth', withCredentials: true });

   export interface LoginResponse {
     user: { id: string; username: string; role: string; status: string };
     permissions: Record<string, { view: boolean; create: boolean; update: boolean; delete: boolean }>;
   }

   export const loginApi = (username: string, password: string): Promise<LoginResponse> =>
     api.post('/login', { username, password }).then(r => r.data);
   export const logoutApi = () => api.post('/logout');
   export const getMeApi = (): Promise<LoginResponse> => api.get('/me').then(r => r.data);
   ```

2. **Modify `src/api/device-api.ts`**
   - Add `withCredentials: true` to existing axios instance:
     ```ts
     const api = axios.create({ baseURL: '/api', withCredentials: true });
     ```
   - Add response interceptor for 401:
     ```ts
     api.interceptors.response.use(
       (res) => res,
       (err) => {
         if (err.response?.status === 401) window.location.href = '/login';
         return Promise.reject(err);
       }
     );
     ```

3. **Create `src/context/auth-context.tsx`**
   - Create context + provider
   - On mount: call `getMeApi()` → if success → set user+permissions → `isAuthenticated=true`; if 401 → stay unauthenticated
   - `login()`: call `loginApi()` → set state
   - `logout()`: call `logoutApi()` → clear state → navigate to /login
   - `isLoading`: true until initial /me resolves
   - Export `useAuth()` hook

4. **Create `src/hooks/use-permission.ts`**
   ```ts
   import { useAuth } from '../context/auth-context';

   export function useCan(module: string, action: 'view' | 'create' | 'update' | 'delete'): boolean {
     const { permissions } = useAuth();
     return permissions[module]?.[action] ?? false;
   }
   ```

5. **Create `src/components/protected-route.tsx`**
   ```tsx
   import { Navigate, Outlet } from 'react-router-dom';
   import { useAuth } from '../context/auth-context';

   export default function ProtectedRoute() {
     const { isAuthenticated, isLoading } = useAuth();
     if (isLoading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
     if (!isAuthenticated) return <Navigate to="/login" replace />;
     return <Outlet />;
   }
   ```

6. **Create `src/components/require-permission.tsx`**
   ```tsx
   import { ReactNode } from 'react';
   import { useCan } from '../hooks/use-permission';

   interface Props {
     module: string;
     action: 'view' | 'create' | 'update' | 'delete';
     children: ReactNode;
     fallback?: ReactNode;
   }

   export default function RequirePermission({ module, action, children, fallback = null }: Props) {
     return useCan(module, action) ? <>{children}</> : <>{fallback}</>;
   }
   ```

7. **Create `src/pages/login-page.tsx`**
   - Centered card with username + password inputs
   - Submit calls `login()` from auth context
   - On success: navigate to /devices (or returnUrl if stored)
   - Error state: show "Sai tên đăng nhập hoặc mật khẩu" or "Tài khoản bị khóa"
   - Styling: consistent with existing Tailwind design (indigo-600 accent, slate bg)

8. **Modify `src/App.tsx`**
   ```tsx
   import { AuthProvider } from './context/auth-context';
   import ProtectedRoute from './components/protected-route';
   import LoginPage from './pages/login-page';

   export default function App() {
     return (
       <BrowserRouter>
         <AuthProvider>
           <Routes>
             <Route path="/login" element={<LoginPage />} />
             <Route path="/public/device/:id" element={<PublicDevicePage />} />

             <Route element={<ProtectedRoute />}>
               <Route element={<AdminLayout />}>
                 <Route path="/" element={<Navigate to="/devices" replace />} />
                 <Route path="/devices" element={<DeviceListPage />} />
                 <Route path="/devices/new" element={<DeviceCreatePage />} />
                 <Route path="/devices/:id" element={<DeviceDetailPage />} />
                 <Route path="/devices/:id/edit" element={<DeviceEditPage />} />
                 <Route path="/locations" element={<LocationListPage />} />
                 {/* Phase 06: /users, Phase 07: /permissions, Phase 08: /audit-logs */}
               </Route>
             </Route>
           </Routes>
         </AuthProvider>
       </BrowserRouter>
     );
   }
   ```

9. **Modify `src/components/app-layout.tsx`**
    - Import `useAuth` and `useCan`
    - Filter `navItems` by permission: only show if `useCan(module, 'view')` is true
    - Replace hardcoded "Admin" user profile at sidebar bottom with `user.username` + `user.role`
    - Add logout button in sidebar footer
    - Conditionally show nav items for /users, /permissions (added in phases 06-07)

10. **Wrap CRUD buttons on existing pages**
    - `DeviceListPage`: wrap "Thêm mới" button with `<RequirePermission module="devices" action="create">`
    - `DeviceDetailPage`: wrap Edit/Delete buttons similarly
    - `LocationListPage`: wrap Create/Edit/Delete buttons with `module="locations"`
    - Maintenance section: wrap create/delete with `module="maintenance"`
    - Pattern: import RequirePermission → wrap button → done

11. **Type-check**
    ```bash
    cd frontend && npx tsc --noEmit
    ```

## Todo List

- [ ] Create src/api/auth-api.ts
- [ ] Modify device-api.ts — withCredentials + 401 interceptor
- [ ] Create src/context/auth-context.tsx
- [ ] Create src/hooks/use-permission.ts
- [ ] Create src/components/protected-route.tsx
- [ ] Create src/components/require-permission.tsx
- [ ] Create src/pages/login-page.tsx
- [ ] Modify App.tsx — AuthProvider + ProtectedRoute + new routes
- [ ] Modify app-layout.tsx — filtered nav + user info + logout
- [ ] Wrap CRUD buttons on DeviceListPage
- [ ] Wrap CRUD buttons on DeviceDetailPage
- [ ] Wrap CRUD buttons on LocationListPage
- [ ] Wrap CRUD buttons on maintenance UI
- [ ] Type-check passes

## Success Criteria
- Unauthenticated user sees login page only — no flash of protected content
- Login with valid creds → redirected to /devices, sidebar shows user info
- Login with wrong creds → error message displayed
- Sidebar hides nav items user can't access
- CRUD buttons hidden when user lacks permission
- Logout clears session → redirected to /login
- 401 from any API → redirected to /login
- 403 from any API → error message (not redirect)
- Change password works end-to-end
- `npx tsc --noEmit` passes

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Flash of content before /me resolves | Medium | Low | isLoading state shows spinner; ProtectedRoute blocks render |
| Stale permission cache after admin changes | Medium | Medium | /me re-fetched on mount; for real-time: could refetch periodically but YAGNI |
| 401 infinite redirect loop | Low | High | Login page doesn't call /me; interceptor only fires on non-auth routes |
| Vite proxy doesn't forward cookies | Low | Medium | Vite proxy preserves cookies by default; verify in dev testing |

## Security Considerations
- Frontend NEVER stores JWT — httpOnly cookie is inaccessible to JS (XSS-safe)
- `withCredentials: true` required for cookie transmission
- Login page: no autocomplete on password field (optional, UX tradeoff)
- Permission checks are UX-only — backend enforces independently
- 403 handler shows generic message, doesn't leak permission details

## Next Steps
- Phase 06: user management pages (consumes /api/users endpoints)
- Phase 07: permission dashboard (consumes /api/permissions endpoints)

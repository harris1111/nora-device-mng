# Phase 03 — Gate Existing Routes

## Context Links
- [Phase 02 — Auth Core](phase-02-backend-auth-core.md) — middleware definitions
- [Current index.ts](../../backend/src/index.ts) — route mounting order
- [device-routes.ts](../../backend/src/routes/device-routes.ts)
- [location-routes.ts](../../backend/src/routes/location-routes.ts)
- [maintenance-routes.ts](../../backend/src/routes/maintenance-routes.ts)
- [attachment-routes.ts](../../backend/src/routes/attachment-routes.ts)
- [transfer-routes.ts](../../backend/src/routes/transfer-routes.ts)

## Overview
- **Priority:** P0
- **Status:** Pending
- **Effort:** 5h
- **Description:** Wire require-auth globally for all /api/* routes (except /api/auth/* and /api/public/*). Add require-permission middleware per route handler. Populate created_by/updated_by on all write operations.

## Key Insights
- Global auth middleware applied in index.ts BEFORE route mounting. Exclusion list for auth + public + health routes.
- Permission middleware applied per-route as second middleware (after multer where applicable).
- Existing route handlers use `Router()` — permission middleware goes on individual route definitions, not router-level.
- `req.user` is guaranteed present after require-auth (TypeScript non-null via middleware ordering).
- Transfer routes are mounted at `/api` with paths like `/devices/:deviceId/transfer/attachments` — module = `transfer`.

## Requirements

### Functional
- F1: All /api/* routes require authentication except: /api/auth/*, /api/public/*, /api/health
- F2: Each route handler enforces permission via `requirePermission(module, action)`
- F3: 401 returned for unauthenticated requests, 403 for insufficient permissions
- F4: Write operations (POST/PUT/DELETE) populate created_by/updated_by from req.user.id
- F5: GET /api/devices/:id/qrcode remains gated (requires `devices.view`)

### Non-functional
- NF1: Existing API response shapes unchanged — only auth headers/cookies added
- NF2: No breaking changes to request body formats

## Architecture

### Global Auth Wiring in index.ts
```ts
import requireAuth from './middleware/require-auth.js';

// Apply auth globally, skip specific paths
app.use('/api', (req, res, next) => {
  const skip = ['/api/auth', '/api/public', '/api/health'];
  if (skip.some(p => req.path.startsWith(p.replace('/api', '')))) return next();
  // Actually: since routes are mounted at /api, req.path is relative
  // Better approach: mount requireAuth on each router, OR use path matching
  requireAuth(req, res, next);
});
```

Better pattern — mount requireAuth explicitly on protected route groups:
```ts
// Unprotected
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.get('/api/health', ...);

// Protected — apply requireAuth before route routers
app.use('/api/devices', requireAuth, deviceRoutes);
app.use('/api/locations', requireAuth, locationRoutes);
app.use('/api', requireAuth, attachmentRoutes);   // /api/attachments/*
app.use('/api', requireAuth, maintenanceRoutes);   // /api/devices/:id/maintenance, /api/maintenance/*
app.use('/api', requireAuth, transferRoutes);      // /api/devices/:id/transfer/*, /api/transfer-attachments/*
```

This is cleaner — no path matching logic, no regex.

### Permission Mapping Per Route

| File | Route | Method | Module | Action |
|------|-------|--------|--------|--------|
| device-routes.ts | `/` | GET | devices | view |
| device-routes.ts | `/:id` | GET | devices | view |
| device-routes.ts | `/` | POST | devices | create |
| device-routes.ts | `/:id` | PUT | devices | update |
| device-routes.ts | `/:id` | DELETE | devices | delete |
| device-routes.ts | `/:id/qrcode` | GET | devices | view |
| location-routes.ts | `/` | GET | locations | view |
| location-routes.ts | `/` | POST | locations | create |
| location-routes.ts | `/:id` | PUT | locations | update |
| location-routes.ts | `/:id` | DELETE | locations | delete |
| maintenance-routes.ts | `/devices/:deviceId/maintenance` | GET | maintenance | view |
| maintenance-routes.ts | `/devices/:deviceId/maintenance` | POST | maintenance | create |
| maintenance-routes.ts | `/maintenance/:id` | PUT | maintenance | update |
| maintenance-routes.ts | `/maintenance/:id` | DELETE | maintenance | delete |
| maintenance-routes.ts | `/maintenance/:id/attachments` | GET | maintenance | view |
| maintenance-routes.ts | `/maintenance/:id/attachments` | POST | maintenance | create |
| attachment-routes.ts | `/devices/:deviceId/attachments` | GET | attachments | view |
| attachment-routes.ts | `/devices/:deviceId/attachments` | POST | attachments | create |
| attachment-routes.ts | `/attachments/:id/file` | GET | attachments | view |
| attachment-routes.ts | `/attachments/:id/primary` | PUT/PATCH | attachments | update |
| attachment-routes.ts | `/attachments/:id` | DELETE | attachments | delete |
| transfer-routes.ts | `/devices/:deviceId/transfer/attachments` | POST | transfer | create |
| transfer-routes.ts | `/transfer-attachments/:id/file` | GET | transfer | view |
| transfer-routes.ts | `/transfer-attachments/:id` | DELETE | transfer | delete |

### Applying Permission Middleware Per Route

Pattern for each route file — add `requirePermission` as middleware arg:

```ts
import { requirePermission } from '../middleware/require-permission.js';

// Before (no auth):
router.get('/', async (req, res) => { ... });

// After:
router.get('/', requirePermission('devices', 'view'), async (req, res) => { ... });
router.post('/', upload.fields([...]), requirePermission('devices', 'create'), async (req, res) => { ... });
```

Note: for routes with multer, permission check goes AFTER multer (multer must parse body before the handler, but permission can go before handler). Actually multer is typically in `.fields()` or `.array()` — these are middleware themselves. Order: `upload.fields([...]), requirePermission('devices', 'create'), handler`.

Wait — multer needs to run to parse multipart. Permission check doesn't need the body. So permission can go BEFORE multer too. Cleaner to reject early:

```ts
router.post('/', requirePermission('devices', 'create'), upload.fields([...]), async (req, res) => { ... });
```

This rejects 403 before wasting time on file upload parsing. Use this order.

### created_by / updated_by Population

In each POST handler, add to `create` data:
```ts
createdById: req.user!.id,
```

In each PUT handler, add to `update` data:
```ts
updatedById: req.user!.id,
```

## Related Code Files

### Files to Modify
- `backend/src/index.ts` — restructure route mounting with requireAuth
- `backend/src/routes/device-routes.ts` — add requirePermission per route + created_by/updated_by
- `backend/src/routes/location-routes.ts` — same
- `backend/src/routes/maintenance-routes.ts` — same
- `backend/src/routes/attachment-routes.ts` — same
- `backend/src/routes/transfer-routes.ts` — same

### Files to Create
- None

### Files to Delete
- None

## Implementation Steps

1. **Modify `index.ts`** — restructure route mounting:
   - Import `requireAuth` from middleware
   - Mount unprotected routes first: `/api/auth`, `/api/public`, `/api/health`
   - Mount protected routes with `requireAuth` middleware: devices, locations, attachments, maintenance, transfer
   - Keep error handlers at bottom unchanged

2. **Modify `device-routes.ts`**:
   - Import `requirePermission`
   - Add `requirePermission('devices', 'view')` to GET `/`, GET `/:id`, GET `/:id/qrcode`
   - Add `requirePermission('devices', 'create')` to POST `/` (before multer upload)
   - Add `requirePermission('devices', 'update')` to PUT `/:id` (before multer upload)
   - Add `requirePermission('devices', 'delete')` to DELETE `/:id`
   - In POST handler: add `createdById: req.user!.id` to prisma.device.create data
   - In PUT handler: add `updatedById: req.user!.id` to prisma.device.update data

3. **Modify `location-routes.ts`**:
   - Same pattern with module `'locations'`
   - POST: `createdById: req.user!.id`
   - PUT: `updatedById: req.user!.id`

4. **Modify `maintenance-routes.ts`**:
   - Module: `'maintenance'`
   - GET `/devices/:deviceId/maintenance` → view
   - POST `/devices/:deviceId/maintenance` → create + createdById
   - PUT `/maintenance/:id` → update + updatedById
   - DELETE `/maintenance/:id` → delete
   - GET/POST `/maintenance/:id/attachments` → view/create (maintenance module, not attachments)

5. **Modify `attachment-routes.ts`**:
   - Module: `'attachments'`
   - createdById on upload, no updatedById (attachments are immutable except primary flag)
   - PUT/PATCH primary → update

6. **Modify `transfer-routes.ts`**:
   - Module: `'transfer'`
   - POST upload → create + createdById
   - GET file → view
   - DELETE → delete

7. **Type-check + manual test**
   ```bash
   cd backend && pnpm run build
   ```
   Test: unauthenticated GET /api/devices → 401. Login → retry → 200 (if permission allows).

## Todo List

- [ ] Restructure index.ts route mounting with requireAuth
- [ ] Add requirePermission to device-routes.ts (5 routes)
- [ ] Add created_by/updated_by to device-routes.ts handlers
- [ ] Add requirePermission to location-routes.ts (4 routes)
- [ ] Add created_by/updated_by to location-routes.ts handlers
- [ ] Add requirePermission to maintenance-routes.ts (6 routes)
- [ ] Add created_by/updated_by to maintenance-routes.ts handlers
- [ ] Add requirePermission to attachment-routes.ts (5 routes)
- [ ] Add created_by/updated_by to attachment-routes.ts handlers
- [ ] Add requirePermission to transfer-routes.ts (3 routes)
- [ ] Add created_by/updated_by to transfer-routes.ts handlers
- [ ] Type-check passes
- [ ] Test: unauthenticated request → 401
- [ ] Test: authenticated but no permission → 403
- [ ] Test: authenticated with permission → 200

## Success Criteria
- All /api/* routes (except auth, public, health) return 401 without valid cookie
- Authenticated requests without permission for the specific action return 403
- Authenticated requests with correct permission succeed as before
- created_by populated on new records
- updated_by populated on updated records
- Existing response shapes unchanged
- `pnpm run build` passes

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Multer + permission middleware ordering | Medium | Medium | Permission BEFORE multer to fail fast |
| Missing requirePermission on a route | Medium | High | Checklist above covers all routes; code review |
| req.user undefined in handler | Low | High | requireAuth runs before all protected routers — guaranteed present |
| Transfer routes mounted at /api conflict | Low | Low | Paths are unique; no collision |

## Security Considerations
- 401 vs 403 distinction: 401 = no/invalid token, 403 = valid token but insufficient role permissions
- Permission check is DB-backed (not JWT claim) — permission changes take effect immediately
- No route should be accidentally unprotected — explicit mounting pattern makes omissions visible
- created_by/updated_by provides attribution trail independent of audit log

## Next Steps
- Phase 04 adds user management and permission CRUD endpoints (using same middleware pattern)
- Phase 05 frontend must handle 401/403 responses gracefully

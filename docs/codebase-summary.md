# Codebase Summary — Nora Device Manager

Generated: May 27, 2026 | Source: `repomix-output.xml`

## Project Overview

Full-stack TypeScript web app for device management with QR code generation, S3 attachments, maintenance tracking, and hierarchical room organization.

- **Backend**: Node.js + Express + Prisma 7 + PostgreSQL (ESM, tsx runtime)
- **Frontend**: React 18 + Vite + Tailwind CSS v4 + React Router v6
- **Storage**: S3-compatible object storage for file attachments
- **Auth**: JWT-based with role/permission system (SADMIN, ADMIN, USER)

## Directory Structure

```
backend/
  prisma/
    schema.prisma          # Prisma schema (Device, RoomNode, Attachment, etc.)
    seed.ts                # Seed script (users, permissions, locations, areas)
  src/
    index.ts               # Express server entry point
    lib/
      prisma-client.ts     # Prisma singleton with pg adapter
      s3-client.ts         # S3 upload/download/delete
      settings.ts          # Base URL config
    routes/
      device-routes.ts     # Device CRUD (multipart, roomId: null filter)
      room-routes.ts       # Room tree CRUD + duplicate + room-scoped devices
      maintenance-routes.ts
      attachment-routes.ts
      location-routes.ts
      public-routes.ts     # Public device info (roomId: null enforced)
      auth-routes.ts       # Login/logout
      user-routes.ts
      permission-routes.ts
      audit-log-routes.ts
      area-routes.ts
      transfer-routes.ts
      inventory-routes.ts
      maintenance-schedule-routes.ts
      inventory-schedule-routes.ts
      export-routes.ts
      settings-routes.ts
      notification-routes.ts
    utils/
      qrcode-generator.ts
      response-mapper.ts
      device-status-rules.ts
      s3-config-validator.ts
      transfer-records.ts
    middleware/
      require-permission.ts
    types/
      uuid.d.ts
    generated/prisma/      # Prisma client output

frontend/
  src/
    api/
      api-client.ts        # Axios instance
      device-api.ts        # Device CRUD + locations/areas
      room-api.ts          # Room tree CRUD
      room-device-api.ts   # Room-scoped device create + duplicate
      auth-api.ts
      user-api.ts
      permission-api.ts
      audit-log-api.ts
      settings-api.ts
    components/
      layout/
        app-layout.tsx     # Nav sidebar with permissions
      auth/
        protected-route.tsx
        permission-route.tsx
      device/
        device-form.tsx
        device-card.tsx
        device-list-row.tsx
        device-status-badge.tsx
      maintenance/
        maintenance-history.tsx
        maintenance-form-modal.tsx
      attachments/
        attachment-list.tsx
        pdf-viewer-modal.tsx
    pages/
      login-page.tsx
      device-list-page.tsx    # Main list (roomId: null)
      device-create-page.tsx
      device-detail-page.tsx
      device-edit-page.tsx
      room-tree-page.tsx      # Tree shell: left tree + right detail
      room-device-create-page.tsx
      room-device-detail-page.tsx
      room-device-edit-page.tsx
      location-list-page.tsx
      area-list-page.tsx
      users-list-page.tsx
      user-form-page.tsx
      permission-dashboard-page.tsx
      audit-log-page.tsx
      settings-page.tsx
      excel-export-page.tsx
    hooks/
      use-permission.ts
    context/
      auth-context.tsx    # AuthProvider with permissions
    App.tsx                # Router with ProtectedRoute + PermissionRoute
```

## Database Schema (key models)

### Device
- Core fields: `storeId`, `name`, `serialNumber`, `model`, `manufacturer`, `description`
- Relations: `locationId`, `areaId`, `roomId` (nullable FK to RoomNode)
- `type`: `tai_san`, `hang_hoai`, `che_do`
- `status`: `active`, `maintenance`, `disposed`, `lost`, `transferred`
- `maintenanceStatus`: `in_use`, `needs_maintenance`
- `inventoryStatus`: `in_use`, `needs_inventory`
- `warrantyPeriod`
- `qrcode` (Bytes), `createdById`, `updatedById`
- Relations: `attachments`, `maintenanceRecords`, `scheduledMaintenance`, `inventoryRecords`, `transferRecord`

### RoomNode (adjacency-table hierarchy)
- `name` (free-form, 255 max)
- `locationId` (required FK to Location)
- `parentId` (nullable FK to self — adjacency list)
- `devices: Device[]` (leaf-only: rooms with children cannot hold devices)
- Audit: `createdById`, `updatedById`

**Leaf-only invariant**: Enforced at create/update time in `room-routes.ts`:
- `validateParentLeafInvariant()` — parent with devices cannot accept children
- Room with `_count.children > 0` cannot receive devices

### Permission
- `role` (SADMIN, ADMIN, USER)
- `module` (devices, locations, areas, rooms, maintenance, maintenance_history, inventory, inventory_history, attachments, transfer, users, permissions)
- `canView`, `canCreate`, `canUpdate`, `canDelete`, `canExport`

### Attachment / MaintenanceAttachment / TransferAttachment / InventoryAttachment
- S3-backed file storage with `fileKey`, `fileName`, `fileType`, `fileSize`
- `isPrimary` flag on Device attachments only

## API Routes

### Device (main list: roomId: null default)
| Method | Endpoint | Note |
|--------|----------|------|
| GET | `/api/devices` | Filters `roomId: null` by default |
| POST | `/api/devices` | Multipart: primary_image, attachments[] |
| GET | `/api/devices/:id` | Single device |
| PUT | `/api/devices/:id` | Update with file upload |
| DELETE | `/api/devices/:id` | |
| POST | `/api/devices/bulk-delete` | Filters `roomId: null` |

### Room
| Method | Endpoint | Note |
|--------|----------|------|
| GET | `/api/rooms` | Flat list for selectors/search |
| GET | `/api/rooms/tree` | Full nested tree (recursive) |
| GET | `/api/rooms/:id` | Detail with breadcrumb + device counts |
| POST | `/api/rooms` | Create: name, location_id, parent_id |
| PUT | `/api/rooms/:id` | Rename or move (name, parent_id) |
| DELETE | `/api/rooms/:id` | Blocked if has children or devices |
| POST | `/api/rooms/:id/duplicate` | Clone subtree + device scalars |

### Room-Scoped Devices
| Method | Endpoint | Note |
|--------|----------|------|
| GET | `/api/rooms/:roomId/devices` | List devices in room |
| POST | `/api/rooms/:roomId/devices` | Create device (auto-sets roomId + locationId) |

### Public (unauthenticated)
| Method | Endpoint | Note |
|--------|----------|------|
| GET | `/api/public/device/:id` | Blocked for room devices (`roomId: null` enforced) |
| GET | `/api/public/attachments/:id/file` | |
| GET | `/api/public/transfer-attachments/:id/file` | |
| GET | `/api/public/maintenance-attachments/:id/file` | |
| GET | `/api/public/inventory-attachments/:id/file` | |

### Auth & Users
| Method | Endpoint | Note |
|--------|----------|------|
| POST | `/api/auth/login` | Returns JWT |
| GET | `/api/auth/me` | Current user + permissions |
| GET | `/api/users` | List users (SADMIN/ADMIN) |
| POST | `/api/users` | Create user (SADMIN) |
| GET/PUT | `/api/users/:id` | |
| GET | `/api/permissions` | Permission matrix |
| GET | `/api/audit-logs` | (SADMIN only) |

## Frontend Routes (App.tsx)

```
/                       → HomeRedirect (devices > rooms > locations > login)
/login                  → LoginPage
/public/device/:id      → PublicDevicePage (room devices blocked)

Protected (PermissionRoute):
  /devices               → DeviceListPage (roomId: null)
  /devices/new          → DeviceCreatePage
  /devices/:id          → DeviceDetailPage
  /devices/:id/edit     → DeviceEditPage

  /rooms                → RoomTreePage
  /rooms/:roomId        → RoomTreePage (detail panel)
  /rooms/:roomId/devices/new  → RoomDeviceCreatePage
  /rooms/:roomId/devices/:deviceId  → RoomDeviceDetailPage
  /rooms/:roomId/devices/:deviceId/edit → RoomDeviceEditPage

  /locations            → LocationListPage
  /areas                → AreaListPage
  /users, /users/new, /users/:id/edit
  /permissions
  /audit-logs, /settings  (SADMIN only)
  /export               → ExcelExportPage (devices.export)
```

## Key Patterns

- **Multer multipart**: device create/update (`primary_image` + 9 attachments), maintenance create (5 files)
- **S3 paths**: `devices/{deviceId}/{id}{ext}`, `maintenance/{recordId}/{id}{ext}`
- **Allowed MIME**: `image/jpeg/png/webp/gif`, `application/pdf`; 10MB limit
- **Prisma 7**: adapter-based (`@prisma/adapter-pg`), schema push only (no migration files), `@ts-nocheck` stripped from generated files
- **ESM backend**: `.js` extension required in all imports for TypeScript files
- **QR codes**: Generated via `qrcode` lib on device create; stored as Bytes
- **Response mapper**: camelCase → snake_case, removes raw DB fields, adds S3 attachment URLs
- **Location scoping**: USER role sees only assigned locations; enforced on devices, rooms, locations
- **Permission middleware**: `requirePermission(module, action)` — returns 403 if no permission

## File Statistics

- **Total Files**: ~2,440 (including all worktrees)
- **Frontend Pages**: 20+
- **Backend Routes**: 17 route files
- **Largest Components**: `device-form.tsx`, `device-detail-page.tsx`, `room-tree-page.tsx`
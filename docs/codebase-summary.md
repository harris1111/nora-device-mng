# Codebase Summary — Nora Device Manager

Last updated: April 12, 2026 | [Repomix output](../repomix-output.xml)

## Project Overview

Nora Device Manager is a full-stack TypeScript web application for managing devices with QR code generation, S3-based file attachments, and maintenance tracking. Built with Node.js/Express backend and React/Vite frontend.

**Tech Stack**: Node.js + Express + Prisma 7 + PostgreSQL | React 18 + Vite + Tailwind CSS v4

## Directory Structure

```
backend/
  prisma/
    schema.prisma           # Prisma database schema (Device, Attachment, MaintenanceRecord, etc.)
    seed.ts                 # Database seeding script
  src/
    index.ts                # Express server entry point
    lib/
      prisma-client.ts      # Singleton Prisma client with adapter
      s3-client.ts          # S3 upload/download/delete operations
    routes/
      device-routes.ts      # Device CRUD endpoints (includes multipart file upload)
      attachment-routes.ts  # Attachment management endpoints
      location-routes.ts    # Location management endpoints
      maintenance-routes.ts # Maintenance records with multipart file support
      public-routes.ts      # Public device info endpoint
    scripts/
      migrate-images-to-s3.ts # One-time migration: database image bytes → S3 attachments (NEW)
    types/
      uuid.d.ts             # UUID type declaration
    utils/
      qrcode-generator.ts   # QR code generation (PNG)
      response-mapper.ts    # Prisma → API response mapping (camelCase, removed image_mime)
      device-status-rules.ts # Status validation logic
      s3-config-validator.ts # S3 environment validation

frontend/
  src/
    api/
      device-api.ts         # Axios client (typed, FormData for uploads)
    components/
      attachment-list.tsx   # Table-based attachments UI (replaces gallery) (NEW)
      pdf-viewer-modal.tsx  # Inline PDF viewer in modal (NEW)
      device-form.tsx       # Form with primary_image + attachments fields
      device-card.tsx       # Device grid card
      device-list-row.tsx   # Device table row
      device-status-badge.tsx # Status indicator
      maintenance-history.tsx # Maintenance records table
      app-layout.tsx        # Router layout
      other components      # Utility components
    pages/
      device-list-page.tsx  # Main devices list
      device-detail-page.tsx # Device with AttachmentList + primary image preview
      device-create-page.tsx # New device form
      device-edit-page.tsx  # Edit device form
      public-device-page.tsx # QR target: read-only device info + AttachmentList
      location-list-page.tsx # Locations management
```

## Backend Architecture

### Database Schema

**Device** (via `prisma/schema.prisma`)
- `id` (UUID, primary)
- `storeId`, `name`, `serialNumber`, `model`, `manufacturer`, `description`
- `locationId` (FK to Location)
- `managedBy`, `ownedBy` (user tracking)
- `qrcode` (Bytes, PNG)
- `type` (enum: `tai_san`, `hang_hoai`, `che_do`) — immutable after create
- `status` (enum: `active`, `maintenance`, `disposed`, `lost`, `transferred`)
- `disposalDate`, `lossDate`, `transferDate`, `transferTo`
- `createdAt`, `updatedAt`
- **Relation**: `attachments: Attachment[]`
- **Relation**: `maintenanceRecords: MaintenanceRecord[]`

**Attachment** (NEW — replaces DB image field)
- `id` (UUID, primary)
- `deviceId` (FK to Device)
- `fileKey` (S3 path: `devices/{deviceId}/{attachmentId}{ext}`)
- `fileName`, `fileType` (MIME), `fileSize`
- `isPrimary` (Boolean — one per device for primary image)
- `createdAt`

**MaintenanceRecord**
- `id` (UUID, primary)
- `deviceId` (FK to Device)
- `date` (DateTime)
- `description` (Text)
- `technician` (String) — **changed from `performed_by`**
- `status` (enum: `pending`, `completed`)
- `createdAt`, `updatedAt`
- **Relation**: `attachments: MaintenanceAttachment[]`

**MaintenanceAttachment**
- `id` (UUID, primary)
- `maintenanceRecordId` (FK)
- `fileKey`, `fileName`, `fileType`, `fileSize`
- `createdAt`

**Location**
- `id`, `name`, `description`, `createdAt`, `updatedAt`

### File Upload Flow

**Device Create/Update** (`device-routes.ts`)
```
POST /api/devices (multipart: primary_image, attachments[])
→ multer.fields([{name: 'primary_image', maxCount: 1}, {name: 'attachments', maxCount: 9}])
→ Create Device record
→ Upload primary_image to S3 as `devices/{deviceId}/{id}{ext}` + create Attachment (isPrimary: true)
→ Upload each attachment to S3 + create Attachment (isPrimary: false)
→ Return device with primary attachment info
```

**Maintenance Create** (`maintenance-routes.ts`)
```
POST /api/devices/:deviceId/maintenance (multipart: date, description, technician, status, files[])
→ multer.array('files', 5)
→ Create MaintenanceRecord
→ Upload each file to S3 as `maintenance/{recordId}/{attachmentId}{ext}`
→ Create MaintenanceAttachment records
→ Return record with attachments
```

### S3 Bucket Structure

- `devices/{deviceId}/{attachmentId}{ext}` — device attachments
- `maintenance/{recordId}/{attachmentId}{ext}` — maintenance record attachments

**Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `application/pdf`

### API Endpoints

| Method | Endpoint | Changes |
|--------|----------|---------|
| GET | `/api/devices` | Returns list (no `image_mime`, uses S3 attachments) |
| POST | `/api/devices` | Multipart: `primary_image`, `attachments[]` (new pattern) |
| PUT | `/api/devices/:id` | Multipart file upload support (new) |
| GET | `/api/devices/:id` | Returns device + primary attachment |
| DELETE | `/api/devices/:id` | — |
| GET | `/api/devices/:id/qrcode` | Returns PNG |
| GET | `/api/devices/:deviceId/maintenance` | Returns records with `technician` field (changed from `performed_by`) |
| POST | `/api/devices/:deviceId/maintenance` | Multipart: `date`, `description`, `technician`, `status`, `files[]` (new) |
| DELETE | `/api/maintenance/:id` | — |
| GET | `/api/public/device/:id` | Public device page data |
| POST/GET/PUT/DELETE | `/api/locations` | Location CRUD |
| GET/DELETE | `/api/attachments/:id/file` | Stream or delete S3 file |

### Response Mapper Updates

`response-mapper.ts` removes old `image_mime` field, adds S3 attachment URLs:
```typescript
{
  ...device,
  primary_image_url: attachment?.fileKey → S3 presigned URL,
  attachments: []
}
```

## Frontend Architecture

### Components

**New** (April 2026)
- `attachment-list.tsx` — Reusable table component for Device/Maintenance attachments, handles view/download/delete, shows PDF inline via PdfViewerModal
- `pdf-viewer-modal.tsx` — Modal with iframe for viewing PDFs at URL

**Modified** (April 2026)
- `device-form.tsx` — Added sections for `primary_image` file picker and `attachments[]` multi-file picker; uses FormData
- `device-detail-page.tsx` — Shows primary image preview; uses AttachmentList for device attachments
- `device-edit-page.tsx` — Passes existing attachment count to form
- `maintenance-history.tsx` — Field renamed: `performed_by` → `technician`; removed `cost`; added file picker; shows AttachmentList per record
- `public-device-page.tsx` — Uses AttachmentList (read-only); shows maintenance attachments

**Deleted** (April 2026)
- `attachment-gallery.tsx` — Old image gallery grid (deprecated, replaced by AttachmentList)

### API Client (`device-api.ts`)

**New Type**
```typescript
interface MaintenanceAttachmentItem {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}
```

**Updated MaintenanceRecord**
```typescript
interface MaintenanceRecord {
  id: string;
  device_id: string;
  date: string;
  description: string;
  technician: string;        // changed from performed_by
  status: 'pending' | 'completed';
  created_at: string;
  attachments: MaintenanceAttachmentItem[];
}
```

### Form Upload Pattern

Device and Maintenance forms use FormData with multipart:
```typescript
const formData = new FormData();
formData.append('name', name);
formData.append('primary_image', primaryImageFile);
formData.append('attachments', attachment1);
formData.append('attachments', attachment2);

await axios.post('/api/devices', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
```

## Migration

**One-time Script**: `backend/src/scripts/migrate-images-to-s3.ts`

This script:
1. Reads `image` (Bytes) and `imageMime` fields from existing Device records
2. Uploads each to S3 at `devices/{deviceId}/{id}.{ext}`
3. Creates Attachment record with `isPrimary: true`
4. Clears the old fields from Device model (via schema removal)

**Run after DB migration:**
```bash
cd backend && npx tsx src/scripts/migrate-images-to-s3.ts
```

## Key Technologies

- **Multer**: Memory storage with field validation; separate handling for `primary_image` + `attachments[]` arrays
- **Prisma 7**: Adapter-based (`@prisma/adapter-pg`); no migration files (schema push only)
- **S3 SDK**: `@aws-sdk/client-s3` with `forcePathStyle: true` for compatible providers
- **FormData**: Frontend file uploads to multipart endpoints
- **QR Code**: `qrcode` library (PNG output)

## File Statistics

- **Total Files**: 84
- **Total Tokens**: ~96K
- **Largest Components**: `device-form.tsx` (5K tokens), `device-detail-page.tsx` (4.5K tokens)

## Standards & Conventions

- **File Naming**: kebab-case (e.g., `attachment-list.tsx`, `device-routes.ts`)
- **Backend ESM**: `.js` imports required for TypeScript files
- **Express Middleware**: Routes validate multer file objects with type casting
- **API Design**: snake_case request/response fields
- **Frontend**: Functional React components, no class components
- **TypeScript**: Strict mode, `tsx` runtime

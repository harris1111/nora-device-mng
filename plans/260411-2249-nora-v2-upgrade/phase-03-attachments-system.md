# Phase 3: Attachments System

## Context Links
- Phase 1 (dependency): [phase-01-postgres-prisma-migration.md](phase-01-postgres-prisma-migration.md)
- Phase 2 (dependency): [phase-02-s3-file-storage.md](phase-02-s3-file-storage.md)
- Current image BLOB: `backend/src/routes/device-routes.js` lines 170-177
- Current device form image upload: `frontend/src/components/device-form.jsx` lines 117-140
- Device detail image display: `frontend/src/pages/device-detail-page.jsx` lines 107-119
- API client: `frontend/src/api/device-api.js`

## Overview
- **Priority:** P1 — Phase 6 and 7 depend on this
- **Status:** Pending (blocked by Phase 1 + 2)
- **Effort:** 6h
- **Branch:** `feat/attachments-system`

Replace single-image BLOB storage with a multi-file attachments system backed by S3. Each device can have multiple attachments (images, PDFs). One attachment per device is marked `is_primary` (used as thumbnail).

## Key Insights
- Current devices table has `image` (BLOB) + `image_mime` columns — these get dropped after migration
- Migration script must: read existing BLOBs → upload to S3 → create attachment rows → drop BLOB columns
- `is_primary` flag: exactly one per device (enforced in app logic, not DB constraint)
- File key pattern: `devices/{deviceId}/{attachmentId}.{ext}` — allows bulk delete on device removal
- Frontend needs: multi-file upload on form, gallery on detail page, primary image indicator

## Requirements

### Functional
- `attachments` table: id, device_id, file_key, file_name, file_type, file_size, is_primary, created_at
- Upload multiple files per device (images + PDFs)
- Download/view individual attachments
- Delete individual attachments
- Set primary attachment (used as device thumbnail)
- Migrate existing BLOB images to S3 + attachments table
- Drop `image` and `image_mime` columns from devices

### Non-Functional
- Max 10 attachments per device (enforced in API)
- Max 10MB per file (update multer limit from 5MB)
- Accepted types: JPEG, PNG, WebP, GIF, PDF

## Architecture

### Prisma Schema Addition

```prisma
model Attachment {
  id        String   @id @default(uuid())
  deviceId  String   @map("device_id")
  device    Device   @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  fileKey   String   @map("file_key")
  fileName  String   @map("file_name")
  fileType  String   @map("file_type")
  fileSize  Int      @map("file_size")
  isPrimary Boolean  @default(false) @map("is_primary")
  createdAt DateTime @default(now()) @map("created_at")

  @@map("attachments")
}
```

Add to Device model: `attachments Attachment[]`
Remove from Device model: `image`, `imageMime` fields (after migration).

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices/:id/attachments` | List device attachments |
| POST | `/api/devices/:id/attachments` | Upload files (multipart, max 5 files per request) |
| GET | `/api/attachments/:id/file` | Stream file from S3 |
| DELETE | `/api/attachments/:id` | Delete attachment + S3 object |
| PATCH | `/api/attachments/:id/primary` | Set as primary attachment |

### Data Flow
```
Upload: Multer(memory) → validate → S3.upload(buffer) → prisma.attachment.create()
Serve:  GET /attachments/:id/file → prisma.attachment.findUnique() → S3.download(key) → pipe to response
Delete: prisma.attachment.delete() → S3.delete(key)
Device delete: onDelete Cascade removes attachment rows; beforeDelete hook cleans S3 objects
```

## Related Code Files

### Files to Create
- `backend/src/routes/attachment-routes.js` — CRUD endpoints for attachments
- `backend/prisma/migrations/xxx_add_attachments/` — Prisma migration (auto-generated)
- `backend/prisma/migrations/xxx_drop_image_blobs/` — drop BLOB columns migration
- `backend/scripts/migrate-blobs-to-s3.js` — one-time migration script
- `frontend/src/api/attachment-api.js` — API client for attachments
- `frontend/src/components/attachment-upload.jsx` — multi-file upload widget
- `frontend/src/components/attachment-gallery.jsx` — gallery display with primary indicator

### Files to Modify
- `backend/prisma/schema.prisma` — add Attachment model, update Device model
- `backend/src/index.js` — register attachment routes
- `backend/src/routes/device-routes.js` — remove `/image` endpoint; add S3 cleanup on device delete
- `frontend/src/components/device-form.jsx` — replace single image upload with attachment upload
- `frontend/src/pages/device-detail-page.jsx` — replace single image with attachment gallery
- `frontend/src/pages/device-list-page.jsx` — update thumbnail URL to use primary attachment
- `frontend/src/components/device-card.jsx` — update image source
- `frontend/src/components/device-list-row.jsx` — update image source
- `frontend/src/api/device-api.js` — update `deviceImageUrl()` to use attachment endpoint

## Implementation Steps

### 1. Update Prisma schema
Add `Attachment` model. Add `attachments` relation to `Device`. Keep `image`/`imageMime` for now.

### 2. Run migration
```bash
npx prisma migrate dev --name add-attachments-table
```

### 3. Create attachment routes

```js
// backend/src/routes/attachment-routes.js
import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma-client.js';
import { uploadFile, downloadFile, deleteFile } from '../lib/s3-client.js';

const router = Router();

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const MAX_PER_DEVICE = 10;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not allowed'), false);
  },
});

// POST /api/devices/:deviceId/attachments
router.post('/devices/:deviceId/attachments', upload.array('files', 5), async (req, res) => {
  // validate device exists, check count limit, upload each to S3, create rows
});

// GET /api/attachments/:id/file
router.get('/attachments/:id/file', async (req, res) => {
  // find attachment, stream from S3
});

// DELETE /api/attachments/:id
router.delete('/attachments/:id', async (req, res) => {
  // delete from S3, then delete row
});

// PATCH /api/attachments/:id/primary
router.patch('/attachments/:id/primary', async (req, res) => {
  // unset all is_primary for device, set this one
});
```

### 4. Update device-routes.js
- Remove `GET /:id/image` endpoint
- On `DELETE /:id`: fetch device's attachments, delete S3 objects, then delete device (cascade handles rows)
- Remove multer `image` handling from create/update — images now go through attachments

### 5. Create migration script for existing BLOBs
```js
// backend/scripts/migrate-blobs-to-s3.js
// Query all devices with non-null image → upload to S3 → create attachment row with is_primary=true
```

### 6. Drop BLOB columns migration
After migration script runs:
```bash
npx prisma migrate dev --name drop-device-image-blobs
```
Remove `image` and `imageMime` from Device model in schema.prisma.

### 7. Create frontend attachment API
```js
// frontend/src/api/attachment-api.js
export const getAttachments = (deviceId) => api.get(`/devices/${deviceId}/attachments`).then(r => r.data);
export const uploadAttachments = (deviceId, files) => { /* FormData with files */ };
export const deleteAttachment = (id) => api.delete(`/attachments/${id}`);
export const setPrimaryAttachment = (id) => api.patch(`/attachments/${id}/primary`).then(r => r.data);
export const attachmentFileUrl = (id) => `/api/attachments/${id}/file`;
```

### 8. Create attachment-upload component
Multi-file drop zone. Shows upload progress. Lists uploaded files with delete button. Mark primary.

### 9. Create attachment-gallery component
Grid of thumbnails (images) + file icons (PDFs). Primary badge. Click to view full size / download.

### 10. Update device-form.jsx
Remove single image upload section. Add `<AttachmentUpload deviceId={...} />` (only shown in edit mode, not create — attachments uploaded after device exists).

For create flow: create device first, then redirect to edit page with attachment upload available.

### 11. Update device-detail-page.jsx
Replace single image display with `<AttachmentGallery deviceId={...} />`.

### 12. Update device-card.jsx and device-list-row.jsx
Change image URL from `deviceImageUrl(device.id)` to primary attachment URL. Backend should include `primary_attachment_id` in device list response.

### 13. Update device API response
Add `primaryAttachmentId` to device query (or include primary attachment in device response).

## Todo List

- [ ] Add Attachment model to Prisma schema
- [ ] Run migration: add attachments table
- [ ] Create `attachment-routes.js` with all CRUD endpoints
- [ ] Register attachment routes in `index.js`
- [ ] Update `device-routes.js`: remove image endpoint, add S3 cleanup on delete
- [ ] Write `scripts/migrate-blobs-to-s3.js`
- [ ] Run BLOB migration, then drop image columns migration
- [ ] Create `frontend/src/api/attachment-api.js`
- [ ] Create `attachment-upload.jsx` component
- [ ] Create `attachment-gallery.jsx` component
- [ ] Update `device-form.jsx` — remove single image, integrate attachments
- [ ] Update `device-detail-page.jsx` — attachment gallery
- [ ] Update `device-card.jsx` + `device-list-row.jsx` — primary attachment thumbnail
- [ ] Update `device-api.js` — new image URL helper
- [ ] Test: upload multiple files, view gallery, set primary, delete, verify S3

## Success Criteria
- Upload 3 files to a device → all visible in gallery
- Set one as primary → shown as thumbnail in device list
- Delete attachment → removed from gallery and S3
- Delete device → all S3 objects cleaned up
- BLOB migration script: all existing images appear as attachments
- No `image`/`image_mime` columns in devices table

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| BLOB migration fails halfway | Med | High | Script is idempotent (skip already-migrated); run in transaction batches |
| S3 delete fails after DB delete | Low | Med | Orphaned S3 objects are harmless; could add cleanup job later |
| Large gallery slows detail page | Low | Low | Max 10 attachments; thumbnails are small |
| Create flow UX (no device ID yet) | Med | Med | Create device first, then enable attachments on edit page |

## Security Considerations
- File type allowlist enforced at multer level (no arbitrary uploads)
- S3 keys are UUIDs — not guessable
- Files served through Express — no direct S3 URLs exposed to client
- Content-Type set from DB record, not from S3 (prevents type confusion)
- `X-Content-Type-Options: nosniff` header on file serve responses

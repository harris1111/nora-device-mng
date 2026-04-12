---
phase: 2
title: "Backend API Changes"
status: pending
effort: 4h
priority: high
depends_on: [phase-01]
---

# Phase 2: Backend API Changes

## Context

- [Device Routes](../../backend/src/routes/device-routes.ts)
- [Attachment Routes](../../backend/src/routes/attachment-routes.ts)
- [Maintenance Routes](../../backend/src/routes/maintenance-routes.ts)
- [Public Routes](../../backend/src/routes/public-routes.ts)
- [S3 Client](../../backend/src/lib/s3-client.ts)

## Overview

Update backend APIs to:
1. Accept `primary_image` + `attachments` files in device create/update (single multipart request)
2. On primary image update: delete old S3 object, upload new, replace Attachment record
3. Accept attachments during maintenance record creation (multipart)
4. Ensure PDF files are served with `Content-Disposition: inline` for iframe viewing

## Key Insights

- Currently device create uses `multer.single('image')` for DB byte storage — need `multer.fields()` for multiple named fields
- Attachment routes already handle S3 upload + Attachment record creation — can extract shared logic
- Maintenance create currently accepts JSON body — need to switch to multipart for file uploads
- Attachment streaming already sets `Content-Disposition: inline` — PDF viewing should work out of the box

## Related Code Files

**Modify:**
- `backend/src/routes/device-routes.ts` — multer.fields, create primary attachment + additional attachments on create/update
- `backend/src/routes/maintenance-routes.ts` — accept multipart with files on create
- `backend/src/routes/attachment-routes.ts` — ensure PDF Content-Disposition: inline (already set)
- `backend/src/routes/public-routes.ts` — include maintenance attachments in response

## Implementation Steps

### 1. Update device-routes.ts — POST /api/devices

Change multer config:
```typescript
// FROM:
upload.single('image')

// TO:
upload.fields([
  { name: 'primary_image', maxCount: 1 },
  { name: 'attachments', maxCount: 9 },
])
```

After creating device, process files:
1. If `primary_image` file exists:
   - Generate UUID, S3 key = `devices/{deviceId}/{attachmentId}{ext}`
   - Upload to S3
   - Create Attachment record with `isPrimary: true`
2. If `attachments` files exist:
   - For each file: generate UUID, upload to S3, create Attachment record (isPrimary: false)
3. Remove `image`/`imageMime` from device create data (columns are gone after Phase 1)

### 2. Update device-routes.ts — PUT /api/devices/:id

Change multer config same as POST.

Primary image logic on update:
1. If `primary_image` file provided:
   - Find existing primary attachment for this device
   - If exists: delete old S3 object, delete old Attachment record
   - Upload new file to S3, create new Attachment with `isPrimary: true`
2. If `attachments` files provided:
   - Check count limit (existing + new <= 10)
   - Upload each, create Attachment records

### 3. Update maintenance-routes.ts — POST create

Change from JSON body to multipart:
```typescript
// FROM:
router.post('/devices/:deviceId/maintenance', async (req, res) => {

// TO:
router.post('/devices/:deviceId/maintenance', upload.array('files', 5), async (req, res) => {
```

After creating MaintenanceRecord:
1. If files present, upload each to S3 at `maintenance/{recordId}/{attachmentId}{ext}`
2. Create MaintenanceAttachment records
3. Return record with attachments array

### 4. Update public-routes.ts — include maintenance attachments

Currently the public route returns maintenance_records. Ensure each record includes its attachments for the public page to display them.

Add `include: { attachments: true }` to maintenance records query if not already present.

### 5. Update ALLOWED_MIMES in device-routes.ts

Currently device routes only allow images. Since attachments can now include PDFs via the device form:
```typescript
// FROM:
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// TO — for primary_image field, keep image-only validation
// For attachments field, allow images + PDF
```

Handle this by checking file.fieldname in the fileFilter:
- `primary_image` -> images only
- `attachments` -> images + PDF

## Todo

- [ ] Update device-routes POST to use `multer.fields`, handle primary_image + attachments
- [ ] Update device-routes PUT with same logic + replace-primary behavior
- [ ] Remove `image`/`imageMime` references from create/update data
- [ ] Update maintenance-routes POST to accept multipart with files
- [ ] Update public-routes to include maintenance attachments
- [ ] Update ALLOWED_MIMES filtering per field name
- [ ] Type check: `cd backend && pnpm run build`

## Success Criteria

- `POST /api/devices` with `primary_image` + `attachments` creates device + S3 files + Attachment records
- `PUT /api/devices/:id` with `primary_image` replaces old primary in S3
- `POST /api/devices/:deviceId/maintenance` with `files` creates record + uploads to S3
- Public device endpoint includes maintenance attachments
- No regression on existing attachment upload/delete/stream endpoints

## Security Considerations

- File type validation remains per-field (images only for primary_image, images+PDF for attachments)
- 5MB/10MB size limits unchanged
- 10 attachments per device limit enforced on combined create
- 5 attachments per maintenance record limit enforced

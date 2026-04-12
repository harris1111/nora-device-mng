---
phase: 1
title: "Schema & Data Migration"
status: pending
effort: 2h
priority: critical
---

# Phase 1: Schema & Data Migration

## Context

- [Prisma Schema](../../backend/prisma/schema.prisma)
- [Response Mapper](../../backend/src/utils/response-mapper.ts)
- [Device Routes](../../backend/src/routes/device-routes.ts)

## Overview

Remove `image`/`imageMime` columns from Device model. Create one-time migration script to move existing DB image bytes to S3 as primary Attachment records.

## Key Insights

- Device model currently has `image` (Bytes?) and `imageMime` (String?) columns storing images as DB bytes
- Attachment model already supports `isPrimary` flag — perfect for primary image designation
- S3 client (`backend/src/lib/s3-client.ts`) already has `uploadFile()` function
- No `updated_at` field exists, not adding it (out of scope)

## Architecture

```
BEFORE: Device.image (Bytes) + Device.imageMime (String)
AFTER:  Attachment.isPrimary=true + Attachment.fileKey -> S3 object

Migration Flow:
  for each device WHERE image IS NOT NULL:
    1. Upload device.image buffer to S3 at devices/{deviceId}/{attachmentId}.{ext}
    2. Create Attachment record (isPrimary=true, deviceId, fileKey, etc.)
    3. Log success
  After all migrated:
    4. Remove image/imageMime columns from schema
    5. Run prisma db push
```

## Related Code Files

**Modify:**
- `backend/prisma/schema.prisma` — remove `image`/`imageMime` fields from Device
- `backend/src/utils/response-mapper.ts` — remove `image_mime` from mapDevice output

**Create:**
- `backend/src/scripts/migrate-images-to-s3.ts` — one-time migration script

## Implementation Steps

### 1. Create migration script `backend/src/scripts/migrate-images-to-s3.ts`

```typescript
// Reads all devices with non-null image
// For each: upload to S3, create Attachment record with isPrimary=true
// Idempotent: skip devices that already have a primary attachment
// Uses existing prisma client and s3 client
```

Logic:
1. Query all devices where `image IS NOT NULL`
2. For each device, check if it already has a primary attachment (skip if so — idempotent)
3. Determine file extension from `imageMime` (e.g., `image/jpeg` -> `.jpg`)
4. Generate UUID for attachment, construct S3 key: `devices/{deviceId}/{attachmentId}{ext}`
5. Upload `device.image` buffer to S3 via `uploadFile()`
6. Create `Attachment` record: `{ id, deviceId, fileKey, fileName: "{name}{ext}", fileType: imageMime, fileSize: image.length, isPrimary: true }`
7. Log progress: `Migrated device {storeId} ({i}/{total})`
8. After all done, print summary

### 2. Update Prisma schema

Remove from Device model:
```diff
-  image        Bytes?
-  imageMime    String?  @map("image_mime")
```

Run `npx prisma db push` to sync (this drops the columns — do AFTER migration script runs).

### 3. Update response mapper

In `mapDevice()`, remove:
```diff
-  image_mime: d.imageMime,
```

The `primary_attachment_id` field already exists in the response — no change needed there.

## Todo

- [ ] Create `backend/src/scripts/migrate-images-to-s3.ts`
- [ ] Test migration script on dev database
- [ ] Remove `image`/`imageMime` from `schema.prisma`
- [ ] Run `prisma db push`
- [ ] Update `response-mapper.ts` to remove `image_mime`
- [ ] Verify existing attachment queries still work

## Success Criteria

- Migration script runs without errors
- All devices with DB images now have S3 primary attachments
- `image`/`imageMime` columns removed from schema
- `mapDevice` no longer returns `image_mime`
- No regression in device list/detail loading

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Migration fails mid-way | Script is idempotent; re-run safely picks up where it left off |
| S3 upload errors | Script logs failures per-device; doesn't halt on single failure |
| Data loss if columns dropped prematurely | Run migration script FIRST, verify counts, THEN drop columns |

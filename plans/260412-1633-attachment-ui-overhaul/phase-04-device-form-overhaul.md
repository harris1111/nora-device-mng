---
phase: 4
title: "Device Form Overhaul"
status: pending
effort: 3h
priority: high
depends_on: [phase-03]
---

# Phase 4: Device Form Overhaul

## Context

- [Current Device Form](../../frontend/src/components/device-form.tsx) — 200 lines, no image/attachment upload
- [Device Create Page](../../frontend/src/pages/device-create-page.tsx)
- [Device Edit Page](../../frontend/src/pages/device-edit-page.tsx)
- [Device API](../../frontend/src/api/device-api.ts)

## Overview

Add two new sections to the device form:
1. **Primary Image** — single image picker with preview (optional)
2. **Attachments** — multi-file upload for images + PDFs

Both sections submit together in a single FormData request.

## Key Insights

- Current form already builds FormData and submits via `onSubmit(fd)` callback
- Device create page calls `createDevice(fd)`, edit page calls `updateDevice(id, fd)`
- Backend (after Phase 2) expects `primary_image` and `attachments` fields in FormData
- Form is ~200 lines; adding image/attachment sections will push it over. Consider extracting file upload sections into sub-components if needed.
- On edit: show existing primary image preview (fetch from attachment URL). Show existing attachments as read-only list with note "Manage attachments on detail page."

## Related Code Files

**Modify:**
- `frontend/src/components/device-form.tsx` — add image + attachment upload sections
- `frontend/src/api/device-api.ts` — update `createDevice`/`updateDevice` if needed (already use FormData)

## Implementation Steps

### 1. Add state for files in device-form.tsx

```typescript
const [primaryImage, setPrimaryImage] = useState<File | null>(null);
const [primaryPreview, setPrimaryPreview] = useState<string | null>(null);
const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
```

For edit mode, if device has `primary_attachment_id`, show existing image preview:
```typescript
const existingPrimaryUrl = initialData?.primary_attachment_id
  ? attachmentFileUrl(initialData.primary_attachment_id) : null;
```

### 2. Add Primary Image section to form (after description, before submit)

```
+--------------------------------------------------+
| Hình ảnh chính (tùy chọn)                        |
|                                                   |
|  [image preview if selected]  [Change] [Remove]  |
|  or                                               |
|  [Click or drag to upload]                        |
|  JPG, PNG, WebP, GIF (≤ 5MB)                     |
+--------------------------------------------------+
```

- File input: accept `image/*` only
- On file select: create object URL for preview
- On remove: clear state
- For edit mode: show existing primary from S3 URL until user selects a new one

### 3. Add Attachments section below primary image

```
+--------------------------------------------------+
| Tệp đính kèm (tùy chọn)                         |
|                                                   |
| [Selected files list with remove buttons]         |
|  invoice.pdf (450 KB) [X]                         |
|  photo-back.png (890 KB) [X]                      |
|                                                   |
| [+ Chọn tệp]                                     |
| JPG, PNG, WebP, GIF, PDF (≤ 10MB, tối đa 9 tệp) |
+--------------------------------------------------+
```

- File input: accept `image/*,.pdf`, multiple
- Show selected files as simple list with filename + size + remove button
- Limit: 9 files (since 1 slot used by primary image, max 10 total)

### 4. Update handleSubmit to append files

```typescript
// In handleSubmit, before await onSubmit(fd):
if (primaryImage) {
  fd.append('primary_image', primaryImage);
}
attachmentFiles.forEach(f => fd.append('attachments', f));
```

### 5. Handle edit mode existing attachments

On edit page:
- Show existing primary image from S3 URL
- Show text: "Tệp đính kèm hiện có: {count} tệp. Quản lý tệp đính kèm ở trang chi tiết."
- New files uploaded via edit will ADD to existing attachments
- New primary image will REPLACE existing primary (backend handles S3 delete)

## Todo

- [ ] Add file state (primaryImage, attachmentFiles) to device-form.tsx
- [ ] Add Primary Image section with preview + file picker
- [ ] Add Attachments section with file list + picker
- [ ] Append files to FormData in handleSubmit
- [ ] Handle edit mode: show existing primary image, existing attachment count
- [ ] Type check: `cd frontend && npx tsc --noEmit`

## Success Criteria

- Create form shows "Primary Image" and "Attachments" sections
- Selecting primary image shows preview
- Selecting attachments shows file list with remove buttons
- Submitting form sends primary_image + attachments in FormData
- Edit form shows existing primary image from S3
- Form stays under control — split into sub-component if >250 lines

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Form becomes too large (>200 lines) | Extract `PrimaryImagePicker` and `AttachmentPicker` as sub-components |
| Large file upload slow on submit | Consider showing upload progress indicator |

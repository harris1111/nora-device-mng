---
phase: 5
title: "Detail, Maintenance & Public Pages"
status: pending
effort: 4h
priority: high
depends_on: [phase-03]
---

# Phase 5: Detail, Maintenance & Public Pages

## Context

- [Device Detail Page](../../frontend/src/pages/device-detail-page.tsx) — 220 lines
- [Public Device Page](../../frontend/src/pages/public-device-page.tsx) — 162 lines
- [Maintenance History](../../frontend/src/components/maintenance-history.tsx) — 170 lines
- [Attachment List (Phase 3)](./phase-03-shared-ui-components.md) — new shared component
- [PDF Viewer Modal (Phase 3)](./phase-03-shared-ui-components.md) — new shared component

## Overview

1. **Device detail page** — replace gallery with large primary image preview + new attachment list table
2. **Maintenance history** — remove cost field, rename performed_by to technician, add file upload to create form, show attachments per record
3. **Public page** — show full attachment list with PDF viewer, show maintenance attachments
4. **Type cleanup** — align all frontend types/references

## Implementation Steps

### 1. Update device-detail-page.tsx

**Attachments section changes:**

Replace:
```tsx
<AttachmentGallery deviceId={device.id} attachments={attachments} onUpdate={...} />
```

With:
```tsx
{/* Large primary image preview */}
{primaryAttachment && primaryAttachment.file_type?.startsWith('image/') && (
  <div className="mb-4 rounded-xl overflow-hidden border border-slate-100">
    <img src={attachmentFileUrl(primaryAttachment.id)} alt={device.name}
      className="w-full max-h-80 object-contain bg-slate-50" />
  </div>
)}

{/* Attachment list table */}
<AttachmentList
  attachments={attachments}
  onDelete={handleDeleteAttachment}
  onSetPrimary={handleSetPrimary}
  onUpload={handleUploadAttachments}
  uploading={uploading}
  maxFiles={10}
  allowUpload={true}
/>
```

Add handlers:
- `handleDeleteAttachment(id)` — call `deleteAttachment(id)`, reload
- `handleSetPrimary(id)` — call `setAttachmentPrimary(id)`, reload
- `handleUploadAttachments(files)` — call `uploadAttachments(deviceId, files)`, reload

**Left column (main card image):**

The left column already reads from `primaryAttachment` URL. After Phase 1 removes DB bytes, this continues to work since it already uses attachment file URLs. No change needed here.

### 2. Update maintenance-history.tsx

**Remove cost field:**
- Remove `cost` from `FormState` interface
- Remove cost input field from form
- Remove cost display from record list (`{r.cost != null && ...}`)

**Rename performed_by to technician:**
- Change `FormState.performed_by` to `technician`
- Update form input name/state references
- Update display: `{r.technician && <span>bởi {r.technician}</span>}`
- Update `handleEdit` to read `record.technician` instead of `record.performed_by`
- Update payload: `technician` instead of `performed_by`

**Add file upload to create form:**
- Add state: `const [files, setFiles] = useState<File[]>([]);`
- Add file input below form fields: accept `image/*,.pdf`, multiple, max 5
- Show selected files list with remove buttons
- On submit:
  - Build FormData instead of JSON payload
  - Append `date`, `description`, `technician`, `status` as form fields
  - Append each file as `files`
  - Call `createMaintenanceRecord(deviceId, formData)` — need to update API function to accept FormData

**Show attachments per record:**
- Each maintenance record in the list now includes `attachments` array (from updated API)
- Below the record description, if `r.attachments?.length > 0`, show mini attachment list
- Reuse `AttachmentList` component in compact mode or show simple file links
- Clicking a PDF opens `PdfViewerModal`

**Update API function:**
In `device-api.ts`, change `createMaintenanceRecord`:
```typescript
// FROM:
export const createMaintenanceRecord = (deviceId: string, data: Record<string, unknown>) =>
  api.post(`/devices/${deviceId}/maintenance`, data).then(r => r.data);

// TO:
export const createMaintenanceRecord = (deviceId: string, data: FormData | Record<string, unknown>) =>
  api.post(`/devices/${deviceId}/maintenance`, data).then(r => r.data);
```

### 3. Update public-device-page.tsx

**Replace image gallery with attachment list:**

Replace the current image-only grid section with:
```tsx
{device.attachments?.length > 0 && (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">
      Tệp đính kèm
    </h2>
    <AttachmentList
      attachments={device.attachments}
      // No onDelete, onSetPrimary, onUpload — read-only
    />
  </div>
)}
```

**Add maintenance attachments display:**

In the maintenance timeline, below each record's description/date:
```tsx
{r.attachments?.length > 0 && (
  <div className="mt-2">
    <AttachmentList attachments={r.attachments} />
  </div>
)}
```

**Remove cost display from maintenance records:**
- Remove `{r.cost != null && <span>...</span>}` line

**Fix performed_by -> technician:**
- Change `{r.performed_by && ...}` to `{r.technician && ...}`

### 4. Update device-api.ts types

```typescript
// Remove from MaintenanceRecord:
performed_by: string | null;
cost: number | null;

// Add:
technician: string | null;
attachments: MaintenanceAttachmentItem[];

// Remove from Device (if still present):
updated_at: string;  // doesn't exist in backend response
```

### 5. Delete attachment-gallery.tsx

After all imports are replaced, remove the file.

## Todo

- [ ] Update device-detail-page: primary image preview + AttachmentList
- [ ] Update maintenance-history: remove cost, rename performed_by -> technician
- [ ] Update maintenance-history: add file upload to create form
- [ ] Update maintenance-history: show attachments per record with PDF viewer
- [ ] Update public-device-page: full attachment list + maintenance attachments
- [ ] Clean up device-api.ts types
- [ ] Delete attachment-gallery.tsx
- [ ] Type check: `cd frontend && npx tsc --noEmit`

## Success Criteria

- Device detail shows large primary image above attachment list table
- Attachment list has view/download/delete/set-primary actions
- Clicking PDF opens modal with iframe viewer
- Maintenance form has no cost field, uses "technician" label
- Maintenance create allows file upload in single submit
- Each maintenance record shows its attachments inline
- Public page shows full attachment list + maintenance attachments + PDF viewer
- All frontend type errors resolved
- `attachment-gallery.tsx` deleted

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| maintenance-history.tsx grows too large | Extract maintenance form into `maintenance-form.tsx` sub-component |
| Public page AttachmentList styling doesn't match minimal design | Use conditional compact mode or simpler variant |

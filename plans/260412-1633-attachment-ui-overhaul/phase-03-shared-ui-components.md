---
phase: 3
title: "Shared UI Components"
status: pending
effort: 3h
priority: high
depends_on: [phase-02]
---

# Phase 3: Shared UI Components

## Context

- [Current Attachment Gallery](../../frontend/src/components/attachment-gallery.tsx) (will be replaced)
- [Device API](../../frontend/src/api/device-api.ts)

## Overview

Create two reusable components:
1. **`pdf-viewer-modal.tsx`** — modal overlay with iframe for inline PDF viewing
2. **`attachment-list.tsx`** — table replacing the gallery grid, with name/type/size/actions columns

Delete `attachment-gallery.tsx` after replacement.

## Key Insights

- PDF viewer uses browser native iframe — zero new dependencies
- Attachment list needs to handle both device attachments and maintenance attachments (slightly different props)
- Current gallery has upload functionality baked in — the new list component should be display-only; upload stays in the form or a separate button
- Set-primary action only applies to device attachments (not maintenance)

## Related Code Files

**Create:**
- `frontend/src/components/pdf-viewer-modal.tsx`
- `frontend/src/components/attachment-list.tsx`

**Delete:**
- `frontend/src/components/attachment-gallery.tsx`

## Implementation Steps

### 1. Create `pdf-viewer-modal.tsx`

Props:
```typescript
interface Props {
  url: string;      // attachment file URL
  fileName: string; // display in header
  onClose: () => void;
}
```

Structure:
- Fixed overlay (bg-black/50, z-50, inset-0)
- Modal container: white bg, rounded, max-w-4xl, max-h-[90vh]
- Header: filename + close button (X)
- Body: `<iframe src={url} className="w-full h-[80vh]" />`
- Close on overlay click + Escape key

### 2. Create `attachment-list.tsx`

Props:
```typescript
interface Props {
  attachments: Attachment[] | MaintenanceAttachmentItem[];
  onDelete?: (id: string) => void;          // omit for read-only (public page)
  onSetPrimary?: (id: string) => void;      // only for device attachments
  onUpload?: (files: File[]) => Promise<void>; // optional upload handler
  uploading?: boolean;
  maxFiles?: number;    // show "X/10" counter
  allowUpload?: boolean; // show upload button
}
```

Table columns:
| Column | Content |
|--------|---------|
| Filename | `a.file_name` (truncated if long) |
| Type | Badge: "Image" (green) / "PDF" (blue) based on file_type |
| Size | Formatted: KB/MB |
| Actions | View (opens PDF modal or image in new tab), Download, Delete (if onDelete), Set Primary (if onSetPrimary + is image + not already primary) |

Behavior:
- Clicking a PDF row opens `PdfViewerModal` with the attachment URL
- Clicking an image row opens in new tab
- Primary attachment gets a star/badge icon next to filename
- Upload button at bottom (if allowUpload) — file input accepting images + PDFs
- Empty state: "Chưa có tệp đính kèm" text

### 3. Update `device-api.ts` — add maintenance attachment interface

Add/update:
```typescript
export interface MaintenanceAttachmentItem {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface MaintenanceRecord {
  id: string;
  device_id: string;
  date: string;
  description: string;
  technician: string | null;  // was "performed_by"
  status: string;
  created_at: string;
  attachments: MaintenanceAttachmentItem[];  // now included
}
```

Remove `cost` and `performed_by` from MaintenanceRecord interface.

### 4. Delete `attachment-gallery.tsx`

After phases 4+5 replace all usages, delete this file.

## Todo

- [ ] Create `frontend/src/components/pdf-viewer-modal.tsx`
- [ ] Create `frontend/src/components/attachment-list.tsx`
- [ ] Update `MaintenanceRecord` and add `MaintenanceAttachmentItem` types in `device-api.ts`
- [ ] Remove `cost`/`performed_by` from `MaintenanceRecord` interface, add `technician`
- [ ] Verify type check: `cd frontend && npx tsc --noEmit`

## Success Criteria

- PDF modal opens with iframe, renders PDF, closes on X/Escape/overlay click
- Attachment list displays rows with name, type badge, size, action buttons
- Clicking PDF opens modal; clicking image opens new tab
- Upload button works when provided
- Components are reusable across device detail, maintenance, and public pages
- `MaintenanceRecord` type matches backend response (technician, no cost)

## Mockup

```
+-----------------------------------------------------------+
| Tệp đính kèm (3)                                         |
+-----------------------------------------------------------+
| Filename              | Type    | Size   | Actions        |
|-----------------------|---------|--------|----------------|
| photo-front.jpg  [*]  | Image   | 1.2 MB | View | Delete  |
| invoice-2024.pdf      | PDF     | 450 KB | View | Delete  |
| photo-back.png        | Image   | 890 KB | View | Pri | Del|
+-----------------------------------------------------------+
| [+ Tải lên tệp]   3/10 tệp                               |
+-----------------------------------------------------------+

[*] = primary badge
Pri = "Đặt chính" button (only for non-primary images)
```

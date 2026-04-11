# Phase 7: Enhanced Public Page

## Context Links
- Phase 3 (dependency): [phase-03-attachments-system.md](phase-03-attachments-system.md) — attachment gallery
- Phase 4 (dependency): [phase-04-device-types-status.md](phase-04-device-types-status.md) — type/status display
- Phase 6 (dependency): [phase-06-maintenance-history.md](phase-06-maintenance-history.md) — maintenance history
- Current public route: `backend/src/routes/public-routes.js` (returns only id, store_id, name, location_name)
- Current public page: `frontend/src/pages/public-device-page.jsx` (minimal card)
- QR code generator: `backend/src/utils/qrcode-generator.js`

## Overview
- **Priority:** P3
- **Status:** Pending (blocked by Phase 3, 4, 6)
- **Effort:** 4h
- **Branch:** `feat/enhanced-public-page`

Transform the minimal public device page into a comprehensive read-only view showing full device details, attachments, and maintenance history (for tai_san). Update QR code to link to the public page URL.

## Key Insights
- Current QR code contains device text info (name, store_id, location) — should instead encode URL to public page
- Public API endpoint currently returns minimal data (4 fields) — expand to full device info
- No auth on public routes — intentionally open (QR scan use case)
- Reuse frontend components where possible: `device-status-badge`, `attachment-gallery` (read-only mode)
- Maintenance history on public page: read-only, no edit/delete buttons

## Requirements

### Functional
- Public API returns full device data: name, store_id, type, status, location, owned_by, serial_number, model, manufacturer, description
- Public API returns device attachments list
- Public API returns maintenance records (if tai_san) with their attachments
- Public page displays all above in a polished read-only layout
- QR code encodes `{BASE_URL}/public/device/{id}` instead of text info

### Non-Functional
- Page loads fast — single API call fetches everything
- Mobile-first layout (QR scanned from phone)
- No admin actions (edit/delete) visible on public page

## Architecture

### Updated Public API

**GET /api/public/device/:id** — expanded response:
```json
{
  "id": "uuid",
  "store_id": "TB-001",
  "name": "Laptop Dell",
  "type": "tai_san",
  "status": "active",
  "location_name": "Phong IT",
  "owned_by": "Phong IT",
  "serial_number": "SN-123",
  "model": "Latitude 5540",
  "manufacturer": "Dell",
  "description": "...",
  "created_at": "2026-01-01T00:00:00.000Z",
  "transfer_to": null,
  "transfer_date": null,
  "attachments": [
    { "id": "uuid", "file_name": "photo.jpg", "file_type": "image/jpeg", "is_primary": true }
  ],
  "maintenance_records": [
    {
      "id": "uuid", "date": "2026-03-01", "description": "Replaced battery",
      "technician": "Nguyen A", "status": "completed",
      "attachments": [{ "id": "uuid", "file_name": "receipt.pdf", "file_type": "application/pdf" }]
    }
  ]
}
```

Maintenance records only included when `type === 'tai_san'`.

### QR Code Change
```js
// backend/src/utils/qrcode-generator.js
// Change from text info to URL
const BASE_URL = process.env.BASE_URL || 'http://localhost:13000';
export async function generateQrCode(deviceId) {
  const url = `${BASE_URL}/public/device/${deviceId}`;
  return QRCode.toBuffer(url, { ... });
}
```

This changes the QR generator signature — callers in device-routes.js must update.

### Data Flow
```
Phone scans QR → browser opens {BASE_URL}/public/device/{id}
  → React SPA loads → calls GET /api/public/device/{id}
  → Backend: prisma query with includes → returns full data
  → Frontend renders read-only detail page
  → Attachment images: <img src="/api/attachments/{id}/file">
  → Maintenance files: <a href="/api/maintenance-attachments/{id}/file">
```

## Related Code Files

### Files to Create
- `frontend/src/components/public-device-detail.jsx` — full read-only device display
- `frontend/src/components/public-attachment-gallery.jsx` — read-only image gallery + file list (or reuse attachment-gallery with `readOnly` prop)
- `frontend/src/components/public-maintenance-list.jsx` — read-only maintenance timeline

### Files to Modify
- `backend/src/routes/public-routes.js` — expand query to include all fields, attachments, maintenance
- `backend/src/utils/qrcode-generator.js` — change to URL-based QR
- `backend/src/routes/device-routes.js` — update QR generation calls (pass deviceId instead of text)
- `frontend/src/pages/public-device-page.jsx` — complete redesign with full detail layout
- `frontend/src/api/device-api.js` — `getPublicDevice()` already works, just returns more data now

## Implementation Steps

### 1. Update QR code generator

```js
// backend/src/utils/qrcode-generator.js
import QRCode from 'qrcode';

const BASE_URL = process.env.BASE_URL || 'http://localhost:13000';

export async function generateQrCode(deviceId) {
  const url = `${BASE_URL}/public/device/${deviceId}`;
  return QRCode.toBuffer(url, {
    type: 'png',
    width: 140,
    margin: 1,
    errorCorrectionLevel: 'H',
  });
}
```

### 2. Update device-routes.js QR calls
Current:
```js
const qrText = `${name.trim()}\nMa: ${store_id.trim()}\nVi tri: ${location.name}`;
const qrcode = await generateQrCode(qrText);
```
Change to:
```js
const qrcode = await generateQrCode(id);
```
Apply in both POST (create) and PUT (update) handlers.

### 3. Expand public-routes.js

```js
router.get('/device/:id', async (req, res) => {
  const device = await prisma.device.findUnique({
    where: { id: req.params.id },
    include: {
      location: { select: { name: true } },
      attachments: {
        select: { id: true, fileName: true, fileType: true, isPrimary: true },
        orderBy: { createdAt: 'asc' },
      },
      maintenanceRecords: {
        include: {
          attachments: { select: { id: true, fileName: true, fileType: true } },
        },
        orderBy: { date: 'desc' },
      },
    },
  });

  if (!device) return res.status(404).json({ error: 'Device not found' });

  const result = {
    id: device.id,
    store_id: device.storeId,
    name: device.name,
    type: device.type,
    status: device.status,
    location_name: device.location?.name || null,
    owned_by: device.ownedBy,
    serial_number: device.serialNumber,
    model: device.model,
    manufacturer: device.manufacturer,
    description: device.description,
    created_at: device.createdAt.toISOString(),
    transfer_to: device.transferTo || null,
    transfer_date: device.transferDate?.toISOString() || null,
    attachments: device.attachments.map(a => ({
      id: a.id, file_name: a.fileName, file_type: a.fileType, is_primary: a.isPrimary,
    })),
    maintenance_records: device.type === 'tai_san' ? device.maintenanceRecords.map(r => ({
      id: r.id,
      date: r.date.toISOString(),
      description: r.description,
      technician: r.technician,
      status: r.status,
      attachments: r.attachments.map(a => ({
        id: a.id, file_name: a.fileName, file_type: a.fileType,
      })),
    })) : undefined,
  };

  res.json(result);
});
```

### 4. Redesign public-device-page.jsx
Mobile-first layout:
- Header: device name + store_id badge + status badge
- Primary image (large, from attachments)
- Info grid: type, location, owner, serial, manufacturer, model
- Description section
- Transfer info (if set)
- Attachment gallery (images viewable, PDFs downloadable)
- Maintenance timeline (tai_san only, read-only)
- Footer: "Managed by Nora" branding

### 5. Create public-attachment-gallery component
Option A: reuse `attachment-gallery.jsx` with a `readOnly` prop that hides delete/set-primary buttons.
Option B: create slim `public-attachment-gallery.jsx` — simpler, no edit logic.

Prefer Option A if attachment-gallery is already clean. Otherwise Option B to avoid prop complexity.

### 6. Create public-maintenance-list component
Read-only timeline similar to current transfer-history pattern:
- Date + status badge
- Description text
- Technician name
- Attachment links (download icons)
- No edit/delete actions

### 7. Update API client (if needed)
`getPublicDevice()` in `device-api.js` already calls the right endpoint. Response shape changes but callers destructure from the returned object — no function signature change needed.

### 8. Regenerate existing QR codes
Existing devices have text-based QR codes stored in DB. Need a one-time script:
```js
// backend/scripts/regenerate-qrcodes.js
// For each device: generate new URL-based QR → update device.qrcode
```

## Todo List

- [ ] Update `qrcode-generator.js` — URL-based QR generation
- [ ] Update `device-routes.js` — change QR generation calls
- [ ] Expand `public-routes.js` — full device data with includes
- [ ] Create `scripts/regenerate-qrcodes.js` — one-time migration
- [ ] Redesign `public-device-page.jsx` — full read-only layout
- [ ] Create read-only attachment display (reuse or new component)
- [ ] Create `public-maintenance-list.jsx` — read-only timeline
- [ ] Test: scan QR → opens public page with full info
- [ ] Test: public page shows attachments (images viewable, PDFs downloadable)
- [ ] Test: tai_san public page shows maintenance history
- [ ] Test: CCDC public page hides maintenance section
- [ ] Run QR regeneration script on existing devices

## Success Criteria
- QR code encodes URL `{BASE_URL}/public/device/{id}`
- Scanning QR opens public page with full device details
- Public page shows device image gallery
- Public page shows maintenance history for tai_san (hidden for CCDC)
- Public page is mobile-responsive (primary QR scan use case)
- No edit/delete/admin actions visible on public page

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| QR URL wrong if BASE_URL misconfigured | Med | High | Documented in env setup; QR regeneration script available |
| Old QR codes (text-based) stop being useful | Certain | Med | Regeneration script updates all existing QRs |
| Public page exposes too much data | Low | Med | No sensitive fields exposed; all data already visible to admin |
| Large maintenance history slows public page | Low | Low | Single query with includes; typical devices have <20 records |

## Security Considerations
- Public endpoint is intentionally unauthenticated — by design
- No write operations on public routes
- Device IDs are UUIDs — not enumerable
- Attachment files served through existing authenticated-capable endpoints (currently no auth, but ready if needed)
- No internal IDs or system metadata exposed (no createdAt on attachments in public response, except device createdAt which is expected)

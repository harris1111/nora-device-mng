# Phase 6: Maintenance/Repair History (Tai san only)

## Context Links
- Phase 1 (dependency): [phase-01-postgres-prisma-migration.md](phase-01-postgres-prisma-migration.md)
- Phase 3 (dependency): [phase-03-attachments-system.md](phase-03-attachments-system.md) — reuse S3 + attachment pattern
- Phase 4 (dependency): [phase-04-device-types-status.md](phase-04-device-types-status.md) — type field needed
- Device detail: `frontend/src/pages/device-detail-page.jsx`
- S3 client: `backend/src/lib/s3-client.js` (from Phase 2)
- Attachment routes pattern: `backend/src/routes/attachment-routes.js` (from Phase 3)

## Overview
- **Priority:** P2
- **Status:** Pending (blocked by Phase 1, 3, 4)
- **Effort:** 5h
- **Branch:** `feat/maintenance-history`

Add maintenance/repair tracking for `tai_san` devices. Each maintenance record has date, description, technician, status, and optional file attachments (stored in S3).

## Key Insights
- Only shown for `tai_san` type devices — CCDC devices don't have maintenance
- Maintenance attachments reuse the S3 infrastructure from Phase 2, but stored in separate Prisma model (linked to maintenance record, not device)
- S3 key pattern: `maintenance/{maintenanceId}/{uuid}.{ext}` — separate namespace from device attachments
- Status is simple: `pending` or `completed`
- Similar CRUD pattern to device attachments — can reuse multer config and S3 helpers

## Requirements

### Functional
- `maintenance_records` table: id, device_id, date, description, technician, status (pending/completed), created_at
- `maintenance_attachments` table: id, maintenance_id, file_key, file_name, file_type, file_size, created_at
- CRUD for maintenance records (scoped to a device)
- Upload/delete file attachments per maintenance record
- View/download maintenance attachments
- Frontend: maintenance history section on device detail page (tai_san only)
- Add/edit/delete maintenance entries with file upload

### Non-Functional
- Max 5 attachments per maintenance record
- Same file type restrictions as device attachments (images + PDF)
- Maintenance records ordered by date descending

## Architecture

### Prisma Schema Additions

```prisma
model MaintenanceRecord {
  id          String   @id @default(uuid())
  deviceId    String   @map("device_id")
  device      Device   @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  date        DateTime
  description String
  technician  String   @default("")
  status      String   @default("pending") // pending | completed
  createdAt   DateTime @default(now()) @map("created_at")
  attachments MaintenanceAttachment[]

  @@map("maintenance_records")
}

model MaintenanceAttachment {
  id              String            @id @default(uuid())
  maintenanceId   String            @map("maintenance_id")
  maintenance     MaintenanceRecord @relation(fields: [maintenanceId], references: [id], onDelete: Cascade)
  fileKey         String            @map("file_key")
  fileName        String            @map("file_name")
  fileType        String            @map("file_type")
  fileSize        Int               @map("file_size")
  createdAt       DateTime          @default(now()) @map("created_at")

  @@map("maintenance_attachments")
}
```

Add to Device model: `maintenanceRecords MaintenanceRecord[]`

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices/:deviceId/maintenance` | List maintenance records (with attachments) |
| POST | `/api/devices/:deviceId/maintenance` | Create maintenance record |
| PUT | `/api/maintenance/:id` | Update maintenance record |
| DELETE | `/api/maintenance/:id` | Delete record + S3 files |
| POST | `/api/maintenance/:id/attachments` | Upload files to record |
| GET | `/api/maintenance-attachments/:id/file` | Stream file from S3 |
| DELETE | `/api/maintenance-attachments/:id` | Delete single attachment |

### Data Flow
```
Create record: POST body (json) → validate device is tai_san → prisma.maintenanceRecord.create()
Upload file:   Multer(memory) → S3.upload() → prisma.maintenanceAttachment.create()
Delete record: fetch attachments → S3.deleteFiles(keys) → prisma.maintenanceRecord.delete() (cascade)
```

## Related Code Files

### Files to Create
- `backend/src/routes/maintenance-routes.js` — CRUD for records + attachments
- `frontend/src/api/maintenance-api.js` — API client
- `frontend/src/components/maintenance-history.jsx` — list of maintenance records with expand/collapse
- `frontend/src/components/maintenance-form.jsx` — add/edit form with file upload

### Files to Modify
- `backend/prisma/schema.prisma` — add MaintenanceRecord, MaintenanceAttachment models
- `backend/src/index.js` — register maintenance routes
- `frontend/src/pages/device-detail-page.jsx` — add maintenance section (conditional on type=tai_san)

## Implementation Steps

### 1. Update Prisma schema + migrate
Add both models. Add `maintenanceRecords` relation to Device.
```bash
npx prisma migrate dev --name add-maintenance-records
```

### 2. Create maintenance-routes.js

**GET /api/devices/:deviceId/maintenance**
```js
const records = await prisma.maintenanceRecord.findMany({
  where: { deviceId },
  include: { attachments: true },
  orderBy: { date: 'desc' },
});
```

**POST /api/devices/:deviceId/maintenance**
```js
// Validate device exists and is tai_san
const device = await prisma.device.findUnique({ where: { id: deviceId } });
if (!device) return 404;
if (device.type !== 'tai_san') return res.status(400).json({ error: 'Maintenance only for tai_san devices' });

const { date, description, technician, status } = req.body;
if (!date || !description?.trim()) return 400;
if (status && !['pending', 'completed'].includes(status)) return 400;

const record = await prisma.maintenanceRecord.create({
  data: { deviceId, date: new Date(date), description: description.trim(), technician: technician?.trim() || '', status: status || 'pending' },
});
```

**PUT /api/maintenance/:id**
```js
// Update date, description, technician, status
```

**DELETE /api/maintenance/:id**
```js
// Fetch attachments → delete S3 objects → delete record (cascade deletes attachment rows)
const record = await prisma.maintenanceRecord.findUnique({ where: { id }, include: { attachments: true } });
if (record.attachments.length) {
  await deleteFiles(record.attachments.map(a => a.fileKey));
}
await prisma.maintenanceRecord.delete({ where: { id } });
```

**POST /api/maintenance/:id/attachments**
```js
// Multer upload.array('files', 5) → S3 upload each → create attachment rows
```

**GET /api/maintenance-attachments/:id/file**
```js
// Find attachment → S3 download → pipe stream
```

**DELETE /api/maintenance-attachments/:id**
```js
// Find → S3 delete → prisma delete
```

### 3. Register routes in index.js
```js
import maintenanceRoutes from './routes/maintenance-routes.js';
app.use('/api', maintenanceRoutes);
```

### 4. Create frontend API client
```js
// frontend/src/api/maintenance-api.js
export const getMaintenanceRecords = (deviceId) => api.get(`/devices/${deviceId}/maintenance`).then(r => r.data);
export const createMaintenanceRecord = (deviceId, data) => api.post(`/devices/${deviceId}/maintenance`, data).then(r => r.data);
export const updateMaintenanceRecord = (id, data) => api.put(`/maintenance/${id}`, data).then(r => r.data);
export const deleteMaintenanceRecord = (id) => api.delete(`/maintenance/${id}`);
export const uploadMaintenanceFiles = (id, files) => { /* FormData */ };
export const maintenanceFileUrl = (id) => `/api/maintenance-attachments/${id}/file`;
export const deleteMaintenanceAttachment = (id) => api.delete(`/maintenance-attachments/${id}`);
```

### 5. Create maintenance-history component
- Fetches records on mount
- List with expand/collapse per record
- Each record shows: date, description, technician, status badge, attachment thumbnails
- Edit/delete buttons per record
- "Add maintenance record" button at top

### 6. Create maintenance-form component
- Modal or inline form
- Fields: date (required), description (required, textarea), technician (text), status (select: pending/completed)
- File upload area (reuse pattern from attachment-upload)
- Works for both create and edit mode

### 7. Update device-detail-page.jsx
After the QR section, add:
```jsx
{device.type === 'tai_san' && (
  <div className="card-glass border border-slate-100 shadow-sm p-6 md:p-8">
    <h2 className="text-lg font-bold text-slate-800 mb-4">Lich su bao tri / Sua chua</h2>
    <MaintenanceHistory deviceId={device.id} />
  </div>
)}
```

## Todo List

- [ ] Add MaintenanceRecord + MaintenanceAttachment to Prisma schema
- [ ] Run migration
- [ ] Create `maintenance-routes.js` — all CRUD + file endpoints
- [ ] Register routes in `index.js`
- [ ] Create `maintenance-api.js` (frontend)
- [ ] Create `maintenance-history.jsx` component
- [ ] Create `maintenance-form.jsx` component
- [ ] Update `device-detail-page.jsx` — conditional maintenance section
- [ ] Test: create record for tai_san device
- [ ] Test: reject record for CCDC device
- [ ] Test: upload/download/delete maintenance attachments
- [ ] Test: delete record cascades attachment cleanup (DB + S3)

## Success Criteria
- Maintenance section visible only on tai_san device detail pages
- Create maintenance record with date + description → appears in list
- Upload PDF to record → downloadable from list
- Delete record → S3 files cleaned up
- API rejects maintenance creation for CCDC devices

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| S3 cleanup fails on record delete | Low | Med | Orphaned files harmless; log warning |
| Type check bypassed if device type changes | None | N/A | Phase 4 makes type immutable after creation |
| Large number of records slows detail page | Low | Low | Pagination if needed later (YAGNI) |

## Security Considerations
- Device type check on every maintenance create — prevents API misuse
- File type allowlist same as device attachments
- Maintenance records cascade-delete with device — no orphans
- S3 keys in `maintenance/` namespace — isolated from device attachments

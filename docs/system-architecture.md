# System Architecture — Nora Device Manager

Last updated: April 12, 2026

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Frontend (Vite)                      │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Pages: device-list, device-detail, device-edit, public  │  │
│  │ Components: attachment-list, pdf-viewer, device-form    │  │
│  │ API: device-api.ts (Axios) + FormData uploads           │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────┬──────────────────────────────────────┘
                            │ REST (FormData, JSON)
┌───────────────────────────▼──────────────────────────────────────┐
│               Express Backend (TypeScript, ESM)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Routes: device-routes, maintenance-routes, etc.          │   │
│  │ Middleware: multer (memory, fields validation)           │   │
│  │ Utils: s3-client, response-mapper, qr-generator          │   │
│  │ ORM: Prisma 7 (schema push, no migrations)               │   │
│  └──────────────────────────────────────────────────────────┘   │
┌──────────────────┬───────────────────────┬───────────────────┐
│                  │                       │                   │
▼                  ▼                       ▼                   ▼
PostgreSQL       S3-Compatible        QR Generation        Logging
(Device data)    (Files)               (via qrcode lib)     (console)
```

## Data Flow Diagrams

### Device Create with Attachments

```
User submits device form
  │
  ├─ Fields: name, storeId, locationId, type, status...
  ├─ File: primary_image (FormData field)
  └─ Files: attachments[] (FormData fields)
  │
  ▼
POST /api/devices (multipart/form-data)
  │
  ▼
Express: multer.fields([
  {name: 'primary_image', maxCount: 1},
  {name: 'attachments', maxCount: 9}
])
  │
  ▼
Validate fields (type, required fields)
  │
  ▼
Create Device record in PostgreSQL
  ├─ record.id = new UUID
  ├─ record.qrcode = generate PNG
  └─ record.[fields] = validated data
  │
  ▼
Upload primary_image to S3
  ├─ Key: devices/{deviceId}/{attachmentId}.{ext}
  ├─ Create Attachment record (isPrimary: true)
  └─ Store: fileKey, fileName, fileType, fileSize
  │
  ▼
Upload attachments[*] to S3 (loop)
  ├─ Key: devices/{deviceId}/{attachmentId}.{ext}
  ├─ Create Attachment records (isPrimary: false)
  └─ Same fields as primary
  │
  ▼
Fetch device with primary attachment
  ├─ mapDevice() removes old image fields
  └─ Returns with S3 URLs
  │
  ▼
200 Created + JSON
```

### Device Detail Load

```
User navigates to /device/:id

Frontend: GET /api/devices/:id
  │
  ▼
Backend:
  ├─ prisma.device.findUnique(...)
  │
  ├─ Include: {location: true, attachments: {...}}
  │   └─ Only fetches ONE attachment where isPrimary: true
  │
  ▼
mapDevice()
  ├─ Returns device object with:
  │  ├─ device info (camelCase → snake_case)
  │  ├─ NO image/imageMime (removed)
  │  └─ primary_image attachment object OR null
  │
  ▼
Frontend receives JSON
  │
  ▼
Device-Detail-Page renders:
  ├─ Primary image preview (if exists)
  ├─ AttachmentList component
  │  ├─ Fetches device attachments (GET /api/devices/:id/attachments)
  │  └─ Renders as table with file icons, download/delete/view actions
  └─ Maintenance history (separate query)
```

### Maintenance Record Create with Files

```
User fills maintenance form + uploads files

Frontend: POST /api/devices/:deviceId/maintenance (multipart/form-data)
  ├─ Fields: date, description, technician, status
  └─ Files: files[] (array of File objects)
  │
  ▼
Express: multer.array('files', 5)
  │
  ▼
Validate:
  ├─ date, description required
  ├─ technician, status optional
  └─ Each file type in MIME whitelist
  │
  ▼
Create MaintenanceRecord
  ├─ id = new UUID
  ├─ deviceId = :deviceId
  ├─ date, description, technician, status
  └─ (NO FOREIGN KEY CASCADE YET — explicit delete)
  │
  ▼
For each file in req.files:
  ├─ attachmentId = new UUID
  ├─ ext = path.extname(originalname) || '.bin'
  ├─ Key = maintenance/{recordId}/{attachmentId}{ext}
  │
  ├─ uploadFile(key, buffer, mimeType)
  │
  └─ Create MaintenanceAttachment
      ├─ file_name, file_type, file_size
      ├─ created_at = now
      └─ maintenanceRecordId = recordId
  │
  ▼
Return record with attachments array
```

### Attachment Viewing (PDF)

```
User clicks "View" on PDF attachment in AttachmentList

Frontend: onClick handler
  │
  ├─ If MIME === 'application/pdf':
  │  └─ Open PdfViewerModal with S3 URL
  │
  └─ If image MIME:
      └─ Open image viewer or download
  │
  ▼
PdfViewerModal <iframe>
  ├─ src = S3 presigned URL (via response-mapper)
  └─ Browser renders PDF inline
```

## Database Schema

### Current Schema (After Attachment Overhaul)

```prisma
model Device {
  id String @id @default(cuid())
  storeId String
  name String
  serialNumber String?
  model String?
  manufacturer String?
  description String?
  qrcode Bytes
  locationId String
  managedBy String @default("")
  ownedBy String @default("")
  type String // enum: tai_san, hang_hoai, che_do
  status String // enum: active, maintenance, disposed, lost, transferred
  disposalDate DateTime?
  lossDate DateTime?
  transferTo String?
  transferDate DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  location Location?
  attachments Attachment[]
  maintenanceRecords MaintenanceRecord[]
  
  // REMOVED in April 2026:
  // image Bytes?
  // imageMime String?
}

model Attachment {
  id String @id @default(cuid())
  deviceId String
  fileKey String
  fileName String
  fileType String // MIME type
  fileSize Int
  isPrimary Boolean @default(false)
  createdAt DateTime @default(now())

  device Device @relation(fields: [deviceId], references: [id], onDelete: Cascade)
}

model MaintenanceRecord {
  id String @id @default(cuid())
  deviceId String
  date DateTime
  description String
  technician String @default("") // Changed from performed_by
  status String @default("pending") // enum: pending, completed
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  device Device @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  attachments MaintenanceAttachment[]
  
  // REMOVED in April 2026:
  // performed_by String?
  // cost Float?
}

model MaintenanceAttachment {
  id String @id @default(cuid())
  maintenanceRecordId String
  fileKey String
  fileName String
  fileType String
  fileSize Int
  createdAt DateTime @default(now())

  record MaintenanceRecord @relation(fields: [maintenanceRecordId], references: [id], onDelete: Cascade)
}

model Location {
  id String @id @default(cuid())
  name String @unique
  description String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  devices Device[]
}
```

## S3 Object Storage

### Bucket Configuration

- **Bucket Name**: (env: `S3_BUCKET`, default: `nora-devices`)
- **Region**: (env: `S3_REGION`, default: `us-east-1`)
- **Path Style**: `forcePathStyle: true` (required for S3-compatible providers)
- **Pre-creation**: Bucket must exist before app starts (not auto-created)

### Path Format

```
Devices:
  devices/{deviceId}/{attachmentId}.{ext}
  Example: devices/550e8400-e29b-41d4-a716-446655440000/abc123.jpg

Maintenance Records:
  maintenance/{recordId}/{attachmentId}.{ext}
  Example: maintenance/xyz789/def456.pdf
```

### File Size & Type Restrictions

| Restriction | Value |
|-------------|-------|
| Max file size | 10 MB per file |
| Allowed types | `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `application/pdf` |
| Max attachments per device | 10 (includes 1 primary) |
| Max files per maintenance record | 5 |

## Frontend Components Interaction

```
Device-List-Page
  │
  ├─ GET /api/devices?type=tai_san&status=active
  │
  └─ Maps to device-card.tsx OR device-list-row.tsx
      │
      ├─ Grid view: device-card.tsx
      │  └─ [Image thumbnail] + [Name] + [Status Badge]
      │
      └─ Table view: device-list-row.tsx

Device-Detail-Page
  │
  ├─ GET /api/devices/:id
  │
  ├─ Renders:
  │  ├─ Device metadata
  │  ├─ Primary image (if exists)
  │  ├─ AttachmentList (GET /api/devices/:id/attachments)
  │  └─ MaintenanceHistory
  │
  └─ Actions: Edit, Delete, Print QR, Add Maintenance

Maintenance-History Component
  │
  ├─ Renders per-record:
  │  ├─ Date, Description, Technician
  │  ├─ Status badge (pending/completed)
  │  └─ AttachmentList (inline per record)
  │
  └─ File upload: POST /api/devices/:id/maintenance

AttachmentList Component (REUSABLE)
  │
  ├─ Accepts: attachments[] + readOnly flag
  │
  ├─ Renders table:
  │  ├─ Filename
  │  ├─ File type icon
  │  ├─ Size
  │  ├─ Actions (View/Download/Delete)
  │  └─ Modified date
  │
  ├─ Actions:
  │  ├─ View: Opens PdfViewerModal OR image viewer
  │  ├─ Download: Href to GET /api/attachments/:id/file
  │  └─ Delete: DELETE /api/attachments/:id (if !readOnly)
  │
  └─ Uses PdfViewerModal for PDFs

PdfViewerModal
  │
  ├─ Input: S3 presigned URL
  │
  └─ Renders: <iframe src={url} />
```

## Security Considerations

### File Upload Validation

1. **Multer field validation**: `fileFilter` checks MIME types + specific field names
2. **Whitelist approach**: Only allowed types accepted; default deny
3. **Size limits**: 10 MB max per file
4. **Memory storage**: Files held in RAM during upload (suitable for small/medium files)

### S3 Access Control

- **Pre-signed URLs**: Used for file downloads (temporary access)
- **Private bucket**: Objects not publicly readable by default
- **Access Key/Secret**: Stored in env vars (never in code)
- **Force Path Style**: Prevents subdomain-based URL issues on S3-compatible providers

### API Security Notes

- No authentication/authorization layer (to be added if needed)
- Field validation on all inputs
- SQL injection prevented by Prisma ORM
- CORS not configured — assumes same-origin requests

## Performance Considerations

### Database Queries

- Device list queries include only primary attachment (WHERE isPrimary: true, LIMIT 1)
- Reduces JOIN bloat for devices with many attachments
- Separate query for full attachment list when needed

### File Upload Strategy

- Memory storage (multer) during transfer
- Direct S3 upload (no intermediate storage)
- Suitable for deployments with adequate RAM
- Future consideration: Direct browser → S3 uploads

### Caching

- No caching layer (Redis) configured
- Browser caching handled via HTTP headers
- Future: Add ETags/304 responses

## Deployment Architecture (Docker)

```
┌─────────────────────────────────┐
│    Docker Compose (Host)        │
│                                 │
│ ┌─────────────┐  ┌───────────┐ │
│ │  Frontend   │  │ Backend   │ │
│ │  (Port      │  │ (Port     │ │
│ │   5173)     │  │  3000)    │ │
│ │             │  │           │ │
│ │  Vite dev   │  │  Express  │ │
│ │  server     │  │  + Prisma │ │
│ └─────────────┘  └───────────┘ │
│      │                │         │
│      └────────────────┘         │
│                                 │
│ ┌─────────────┐  ┌───────────┐ │
│ │ PostgreSQL  │  │ (Nothing  │ │
│ │ (Port 5432) │  │  External)│ │
│ └─────────────┘  └───────────┘ │
└─────────────────────────────────┘
         │
         ▼
    S3-Compatible Storage
    (iDrive e2, MinIO, AWS S3)
```

**Production**: Single container image (multi-stage build) with frontend + backend on ports 13000 (external), 3000 (internal backend)

## Key Integration Points

1. **Multer ↔ Express Routes**: Field-based file handling with async middleware
2. **Prisma ↔ S3**: Transaction-like pattern (DB record created first, then S3 upload)
3. **Frontend FormData ↔ Express Multipart**: Axios + FormData posts to `multer.fields()`
4. **QR Code Generation**: Sync operation, stored as BLOB in Device.qrcode
5. **Response Mapping**: Singleton utility converts Prisma objects to API responses

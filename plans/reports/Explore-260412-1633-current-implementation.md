# Nora Device Manager - Current Implementation Exploration

## Summary
The Nora Device Manager is a complete device lifecycle management system with:
- Full CRUD for devices, locations, maintenance records, and attachments
- S3-based file storage for attachments and images
- Device type/status validation system
- Public read-only device pages
- QR code generation for devices
- Responsive frontend with device cards, lists, and detail views

---

## Database Schema (Prisma)

### Core Models

**Location**
- `id` (UUID, PK)
- `name` (string, unique)
- `createdAt` (timestamp)
- `devices` (relation to Device[])

**Device**
- `id` (UUID, PK)
- `storeId` (string) - required
- `name` (string)
- `locationId` (UUID, FK) - optional
- `location` (relation)
- `managedBy` (string, default="")
- `ownedBy` (string, default="")
- `serialNumber` (string, default="")
- `model` (string, default="")
- `manufacturer` (string, default="")
- `description` (string, default="")
- `image` (bytes) - device image
- `imageMime` (string)
- `qrcode` (bytes) - generated QR code
- `type` (string, default="tai_san") - device type enum
- `status` (string, default="active") - device status enum
- `disposalDate` (timestamp, optional)
- `lossDate` (timestamp, optional)
- `transferTo` (string, optional)
- `transferDate` (timestamp, optional)
- `createdAt` (timestamp)
- `attachments` (relation to Attachment[])
- `maintenanceRecords` (relation to MaintenanceRecord[])

**Attachment** (device files)
- `id` (UUID, PK)
- `deviceId` (UUID, FK)
- `device` (relation)
- `fileKey` (string) - S3 key
- `fileName` (string)
- `fileType` (string)
- `fileSize` (int)
- `isPrimary` (boolean, default=false)
- `createdAt` (timestamp)

**MaintenanceRecord**
- `id` (UUID, PK)
- `deviceId` (UUID, FK)
- `device` (relation)
- `date` (timestamp)
- `description` (string)
- `technician` (string, default="")
- `status` (string, default="pending")
- `createdAt` (timestamp)
- `attachments` (relation to MaintenanceAttachment[])

**MaintenanceAttachment** (maintenance record files)
- `id` (UUID, PK)
- `maintenanceId` (UUID, FK)
- `maintenance` (relation)
- `fileKey` (string) - S3 key
- `fileName` (string)
- `fileType` (string)
- `fileSize` (int)
- `createdAt` (timestamp)

**Note:** No `updated_at` field exists on any models; only `createdAt` is tracked.

---

## Backend API Endpoints

### Device Routes (`/api/devices`)

GET `/api/devices` - List all devices (filters: type, status)
GET `/api/devices/:id` - Get device detail with location
POST `/api/devices` - Create device (multipart, image)
PUT `/api/devices/:id` - Update device (multipart, image)
DELETE `/api/devices/:id` - Delete device + cascading S3 cleanup
GET `/api/devices/:id/qrcode` - Stream device QR code PNG

Device type/status validation:
- tai_san: active, under_repair, decommissioned
- cong_cu_dung_cu: active, disposed, lost
- Device type immutable after creation

### Attachment Routes

GET `/api/devices/:deviceId/attachments` - List attachments
POST `/api/devices/:deviceId/attachments` - Upload files (max 10 per device)
GET `/api/attachments/:id/file` - Stream attachment from S3
DELETE `/api/attachments/:id` - Delete attachment + S3
PATCH `/api/attachments/:id/primary` - Set as primary

Constraints: Max 10 attachments per device, 5MB per file, JPEG/PNG/WebP/GIF/PDF only

### Maintenance Routes

GET `/api/devices/:deviceId/maintenance` - List records
POST `/api/devices/:deviceId/maintenance` - Create record
PUT `/api/maintenance/:id` - Update record
DELETE `/api/maintenance/:id` - Delete record + S3 cleanup
POST `/api/maintenance/:id/attachments` - Upload files (max 5 per record)
GET `/api/maintenance-attachments/:id/file` - Stream file from S3
DELETE `/api/maintenance-attachments/:id` - Delete single attachment

Constraints: Only for tai_san devices, max 5 attachments per record

### Location Routes (`/api/locations`)

GET `/api/locations` - List all locations
GET `/api/locations/:id` - Get location
POST `/api/locations` - Create location (unique name, max 255 chars)
PUT `/api/locations/:id` - Update location
DELETE `/api/locations/:id` - Delete location (blocked if devices assigned)

### Public Routes

GET `/api/public/device/:id` - Get full device details + attachments + maintenance (read-only)

---

## Frontend Structure

### Pages
- device-list-page.tsx - Main device list view
- device-detail-page.tsx - Device detail, attachments, maintenance history
- device-create-page.tsx - Create new device form
- device-edit-page.tsx - Edit device form
- location-list-page.tsx - Manage locations
- public-device-page.tsx - Public read-only device view

### Components
- app-layout.tsx - Main app wrapper/navigation
- device-form.tsx - Reusable device create/edit form
- device-list-row.tsx - Single device table row
- device-card.tsx - Card view of device
- device-status-badge.tsx - Status display badge
- attachment-gallery.tsx - Device attachment display
- maintenance-history.tsx - Maintenance records timeline
- qrcode-display.tsx - QR code viewer
- print-qrcode-button.tsx - Print QR code functionality
- view-toggle.tsx - Switch between list/card views
- form-text-input.tsx - Reusable form input
- device-constants.ts - Type/status labels

---

## Key Implementation Details

### File Storage
- S3 integration for all attachments (devices and maintenance)
- S3 key structure: devices/{deviceId}/{attachmentId}{ext}, maintenance/{maintenanceId}/{attachmentId}{ext}
- Cascading deletion removes all S3 files

### Device Images
- Stored as bytes in database (not S3)
- MIME type tracked separately
- Max 5MB image size

### QR Codes
- Generated and stored as PNG bytes in database
- Endpoint: /api/devices/:id/qrcode

### Primary Attachment
- Devices track one "primary" attachment
- First uploaded becomes primary automatically
- When deleted, next oldest becomes primary

### Maintenance
- Only for tai_san type devices
- Status: pending or completed
- Max 5 attachments per record
- Fields: date, description, technician, status

---

## Unresolved Gaps

1. **No updated_at tracking** - Only createdAt exists; no edit audit trail
2. **Type mismatch** - Frontend API expects "performed_by" and "cost" in MaintenanceRecord but schema has "technician" and no cost field
3. **No authentication visible** - No auth endpoints in explored routes
4. **Image storage scaling** - Device images as bytes may not scale for large datasets
5. **Cost tracking** - Mentioned in types but not implemented in schema

---

## File Locations

Backend routes: /f/Windows/Study/Selfhost/nora-device-mng/backend/src/routes/
Prisma schema: /f/Windows/Study/Selfhost/nora-device-mng/backend/prisma/schema.prisma
Frontend pages: /f/Windows/Study/Selfhost/nora-device-mng/frontend/src/pages/
Frontend components: /f/Windows/Study/Selfhost/nora-device-mng/frontend/src/components/
API client: /f/Windows/Study/Selfhost/nora-device-mng/frontend/src/api/device-api.ts


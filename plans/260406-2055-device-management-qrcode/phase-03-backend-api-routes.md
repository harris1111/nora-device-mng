# Phase 3: Backend — API Routes

## Context Links
- [Plan Overview](plan.md)
- [Phase 2: Database](phase-02-backend-database.md)

## Overview
- **Priority**: P1
- **Status**: Pending
- **Effort**: 3h
- **Blocked by**: Phase 2
- **Description**: Implement all REST API endpoints — device CRUD with image upload, QR code generation, image/QR serving, and public device endpoint

## Key Insights
- multer with `memoryStorage` — keeps uploaded files in memory as Buffers, perfect for BLOB storage
- QR code generated at creation time, stored as PNG Buffer — avoids runtime generation on every request
- Public route serves minimal JSON — frontend renders the public page via React route
- Image serving needs correct Content-Type header from stored `image_mime`

## Requirements

### Functional
- Full CRUD for devices via REST API
- Image upload via multipart/form-data (max 5MB)
- QR code auto-generated on device creation
- Binary endpoints serve images and QR codes with correct MIME types
- Public endpoint returns device name + ID as JSON

### Non-functional
- Input validation on required fields (name)
- Proper HTTP status codes (201, 400, 404, 204)
- Error responses as JSON with `error` field

## Architecture

### API Endpoints
```
POST   /api/devices           → Create device (multipart: image + name)
GET    /api/devices           → List all devices
GET    /api/devices/:id       → Get device detail
PUT    /api/devices/:id       → Update device (multipart: image + name)
DELETE /api/devices/:id       → Delete device
GET    /api/devices/:id/image → Serve device image (binary)
GET    /api/devices/:id/qrcode → Serve QR code PNG (binary)
GET    /api/public/device/:id → Public device info (JSON: name + id)
```

### Request/Response Flow
```
POST /api/devices
  ← multipart: { name: "Router A", image: <file> }
  → Generate UUID
  → Generate QR code (encodes: {BASE_URL}/public/device/{id})
  → Insert into DB (name, image buffer, image mime, QR buffer)
  → 201 { id, name, created_at }

GET /api/devices/:id/image
  → Query DB for image BLOB + mime
  → Set Content-Type header
  → Send raw buffer
```

## Related Code Files

### Files to Create
```
backend/src/routes/device-routes.js
backend/src/routes/public-routes.js
backend/src/utils/qrcode-generator.js
```

### Files to Modify
```
backend/src/index.js  (mount routes)
```

## Implementation Steps

### 1. Create QR Code Generator Utility

`backend/src/utils/qrcode-generator.js`:
```javascript
import QRCode from 'qrcode';

export async function generateQrCode(url) {
  // Returns PNG buffer
  return QRCode.toBuffer(url, {
    type: 'png',
    width: 300,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
}
```

### 2. Configure Multer

In `device-routes.js`:
```javascript
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'), false);
    }
  },
});
```

### 3. Implement Device Routes

`backend/src/routes/device-routes.js`:

**POST /api/devices** — Create device
```javascript
router.post('/', upload.single('image'), async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

  const id = uuidv4();
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const publicUrl = `${baseUrl}/public/device/${id}`;
  const qrcode = await generateQrCode(publicUrl);

  createDevice({
    id,
    name: name.trim(),
    image: req.file?.buffer || null,
    imageMime: req.file?.mimetype || null,
    qrcode,
  });

  const device = getDeviceById(id);
  res.status(201).json(device);
});
```

**GET /api/devices** — List all
```javascript
router.get('/', (req, res) => {
  res.json(getAllDevices());
});
```

**GET /api/devices/:id** — Get one
```javascript
router.get('/:id', (req, res) => {
  const device = getDeviceById(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  res.json(device);
});
```

**PUT /api/devices/:id** — Update
```javascript
router.put('/:id', upload.single('image'), (req, res) => {
  const existing = getDeviceById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Device not found' });

  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

  updateDevice(req.params.id, {
    name: name.trim(),
    image: req.file?.buffer || null,
    imageMime: req.file?.mimetype || null,
  });

  res.json(getDeviceById(req.params.id));
});
```

**DELETE /api/devices/:id** — Delete
```javascript
router.delete('/:id', (req, res) => {
  const result = deleteDevice(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Device not found' });
  res.status(204).send();
});
```

**GET /api/devices/:id/image** — Serve image
```javascript
router.get('/:id/image', (req, res) => {
  const data = getDeviceImage(req.params.id);
  if (!data?.image) return res.status(404).json({ error: 'Image not found' });
  res.set('Content-Type', data.image_mime);
  res.send(data.image);
});
```

**GET /api/devices/:id/qrcode** — Serve QR code
```javascript
router.get('/:id/qrcode', (req, res) => {
  const data = getDeviceQrcode(req.params.id);
  if (!data?.qrcode) return res.status(404).json({ error: 'QR code not found' });
  res.set('Content-Type', 'image/png');
  res.send(data.qrcode);
});
```

### 4. Implement Public Route

`backend/src/routes/public-routes.js`:
```javascript
router.get('/device/:id', (req, res) => {
  const device = getDeviceById(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  res.json({ id: device.id, name: device.name });
});
```

### 5. Mount Routes in index.js

```javascript
import deviceRoutes from './routes/device-routes.js';
import publicRoutes from './routes/public-routes.js';

app.use('/api/devices', deviceRoutes);
app.use('/api/public', publicRoutes);
```

### 6. Add Error Handling Middleware

```javascript
// Multer error handler
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large (max 5MB)' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.message === 'Only image files allowed') {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});
```

## Todo List

- [ ] Create `qrcode-generator.js` utility
- [ ] Configure multer with memory storage and 5MB limit
- [ ] Implement POST /api/devices (create + QR generation)
- [ ] Implement GET /api/devices (list)
- [ ] Implement GET /api/devices/:id (detail)
- [ ] Implement PUT /api/devices/:id (update)
- [ ] Implement DELETE /api/devices/:id
- [ ] Implement GET /api/devices/:id/image (serve image BLOB)
- [ ] Implement GET /api/devices/:id/qrcode (serve QR BLOB)
- [ ] Implement GET /api/public/device/:id (public info)
- [ ] Mount routes in index.js
- [ ] Add multer error handling middleware
- [ ] Test all endpoints with curl or Postman

## Success Criteria
- All endpoints return correct status codes and response formats
- Image upload stores BLOB correctly, serves with right Content-Type
- QR code generated at creation, encodes correct public URL
- Public endpoint returns minimal JSON (name + id only)
- 404 for non-existent devices on all endpoints
- 400 for missing name or invalid file type

## Risk Assessment
- **BASE_URL configuration**: QR encodes a URL that depends on deployment host. Use `BASE_URL` env var; fallback to request host in dev. If host changes, QR codes become stale → future: add `/api/devices/:id/regenerate-qr` endpoint
- **Large image uploads**: Multer 5MB limit + image-only filter mitigates abuse
- **Memory usage**: multer memoryStorage holds file in RAM; 5MB limit keeps this safe for single-user app

## Security Considerations
- File type validation via MIME check in multer filter
- Parameterized SQL queries (from Phase 2)
- No auth needed per requirements, but all write endpoints are open — acceptable for internal tool

## Next Steps
→ Phase 4: Frontend core pages (list, detail, create, edit)

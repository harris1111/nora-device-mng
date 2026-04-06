import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import {
  getAllDevices,
  getDeviceById,
  getDeviceImage,
  getDeviceQrcode,
  createDevice,
  updateDevice,
  deleteDevice,
} from '../database.js';
import { generateQrCode } from '../utils/qrcode-generator.js';

const router = Router();

// Allowed image MIME types (C3 fix — reject SVG and other risky types)
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Multer config — memory storage, 5MB limit, allowlisted image types
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'), false);
    }
  },
});

// GET /api/devices — list all devices
router.get('/', (req, res) => {
  res.json(getAllDevices());
});

// GET /api/devices/:id — get device detail
router.get('/:id', (req, res) => {
  const device = getDeviceById(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  res.json(device);
});

// POST /api/devices — create device with image upload
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (name.trim().length > 255) return res.status(400).json({ error: 'Name too long (max 255 chars)' });

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
  } catch (err) {
    console.error('Create device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/devices/:id — update device
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

// DELETE /api/devices/:id — delete device
router.delete('/:id', (req, res) => {
  const result = deleteDevice(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Device not found' });
  res.status(204).send();
});

// GET /api/devices/:id/image — serve device image binary
router.get('/:id/image', (req, res) => {
  const data = getDeviceImage(req.params.id);
  if (!data?.image) return res.status(404).json({ error: 'Image not found' });
  res.set('Content-Type', data.image_mime);
  res.set('X-Content-Type-Options', 'nosniff');
  res.send(data.image);
});

// GET /api/devices/:id/qrcode — serve QR code PNG
router.get('/:id/qrcode', (req, res) => {
  const data = getDeviceQrcode(req.params.id);
  if (!data?.qrcode) return res.status(404).json({ error: 'QR code not found' });
  res.set('Content-Type', 'image/png');
  res.set('X-Content-Type-Options', 'nosniff');
  res.send(data.qrcode);
});

export default router;

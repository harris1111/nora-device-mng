import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma-client.js';
import { mapDevice } from '../utils/response-mapper.js';
import { generateQrCode } from '../utils/qrcode-generator.js';
import { validateTypeStatus, applyDateStatusRules, type StatusData } from '../utils/device-status-rules.js';
import { deleteFiles } from '../lib/s3-client.js';

const router: ReturnType<typeof Router> = Router();

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
  },
});

const deviceIncludes = {
  location: true,
  attachments: { where: { isPrimary: true }, select: { id: true, isPrimary: true }, take: 1 },
};

// GET /api/devices — list all devices
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type, status } = req.query as { type?: string; status?: string };
    const where: Record<string, string> = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const devices = await prisma.device.findMany({
      where,
      include: deviceIncludes,
      orderBy: { createdAt: 'desc' },
    });
    res.json(devices.map(mapDevice));
  } catch (err) {
    console.error('List devices error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/devices/:id — get device detail
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const device = await prisma.device.findUnique({
      where: { id: req.params.id as string },
      include: deviceIncludes,
    });
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(mapDevice(device));
  } catch (err) {
    console.error('Get device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/devices — create device
router.post('/', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { name, store_id, location_id, managed_by, owned_by, serial_number, model: deviceModel, manufacturer, description, type, status, disposal_date, loss_date, transfer_to, transfer_date } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (name.trim().length > 255) return res.status(400).json({ error: 'Name too long (max 255 chars)' });
    if (!store_id?.trim()) return res.status(400).json({ error: 'Store ID is required' });
    if (!location_id?.trim()) return res.status(400).json({ error: 'Location is required' });

    const location = await prisma.location.findUnique({ where: { id: location_id.trim() } });
    if (!location) return res.status(400).json({ error: 'Invalid location selected' });

    const deviceType = type || 'tai_san';
    const deviceStatus = status || 'active';
    const typeErr = validateTypeStatus(deviceType, deviceStatus);
    if (typeErr) return res.status(400).json({ error: typeErr });

    let statusData: StatusData = { type: deviceType, status: deviceStatus, disposalDate: disposal_date ? new Date(disposal_date) : null, lossDate: loss_date ? new Date(loss_date) : null };
    statusData = applyDateStatusRules(deviceType, statusData);

    const id = uuidv4();
    const qrcode = await generateQrCode(id);

    const device = await prisma.device.create({
      data: {
        id,
        storeId: store_id.trim(),
        name: name.trim(),
        locationId: location_id.trim(),
        managedBy: managed_by?.trim() || '',
        ownedBy: owned_by?.trim() || '',
        serialNumber: serial_number?.trim() || '',
        model: deviceModel?.trim() || '',
        manufacturer: manufacturer?.trim() || '',
        description: description?.trim() || '',
        image: req.file?.buffer ? new Uint8Array(req.file.buffer) : null,
        imageMime: req.file?.mimetype || null,
        qrcode: new Uint8Array(qrcode),
        type: statusData.type,
        status: statusData.status,
        disposalDate: statusData.disposalDate,
        lossDate: statusData.lossDate,
        transferTo: transfer_to?.trim() || null,
        transferDate: transfer_date ? new Date(transfer_date) : null,
      },
      include: deviceIncludes,
    });

    res.status(201).json(mapDevice(device));
  } catch (err) {
    console.error('Create device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/devices/:id — update device
router.put('/:id', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.device.findUnique({ where: { id: req.params.id as string } });
    if (!existing) return res.status(404).json({ error: 'Device not found' });

    const { name, store_id, location_id, managed_by, owned_by, serial_number, model: deviceModel, manufacturer, description, type, status, disposal_date, loss_date, transfer_to, transfer_date } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (name.trim().length > 255) return res.status(400).json({ error: 'Name too long (max 255 chars)' });
    if (!store_id?.trim()) return res.status(400).json({ error: 'Store ID is required' });
    if (!location_id?.trim()) return res.status(400).json({ error: 'Location is required' });

    if (type && type !== existing.type) {
      return res.status(400).json({ error: 'Device type cannot be changed after creation' });
    }

    const location = await prisma.location.findUnique({ where: { id: location_id.trim() } });
    if (!location) return res.status(400).json({ error: 'Invalid location selected' });

    const deviceStatus = status || existing.status;
    const typeErr = validateTypeStatus(existing.type, deviceStatus);
    if (typeErr) return res.status(400).json({ error: typeErr });

    let statusData: StatusData = {
      type: existing.type,
      status: deviceStatus,
      disposalDate: disposal_date ? new Date(disposal_date) : (disposal_date === '' ? null : existing.disposalDate),
      lossDate: loss_date ? new Date(loss_date) : (loss_date === '' ? null : existing.lossDate),
    };
    statusData = applyDateStatusRules(existing.type, statusData);

    const qrcode = await generateQrCode(req.params.id as string);

    const updateData: Record<string, unknown> = {
      storeId: store_id.trim(),
      name: name.trim(),
      locationId: location_id.trim(),
      managedBy: managed_by?.trim() || '',
      ownedBy: owned_by?.trim() || '',
      serialNumber: serial_number?.trim() || '',
      model: deviceModel?.trim() || '',
      manufacturer: manufacturer?.trim() || '',
      description: description?.trim() || '',
      qrcode,
      status: statusData.status,
      disposalDate: statusData.disposalDate,
      lossDate: statusData.lossDate,
      transferTo: transfer_to?.trim() || null,
      transferDate: transfer_date ? new Date(transfer_date) : null,
    };

    if (req.file) {
      updateData.image = req.file.buffer;
      updateData.imageMime = req.file.mimetype;
    }

    const device = await prisma.device.update({
      where: { id: req.params.id as string },
      data: updateData,
      include: deviceIncludes,
    });

    res.json(mapDevice(device));
  } catch (err) {
    console.error('Update device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/devices/:id — delete device + S3 cleanup
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const device = await prisma.device.findUnique({
      where: { id: req.params.id as string },
      include: {
        attachments: { select: { fileKey: true } },
        maintenanceRecords: { include: { attachments: { select: { fileKey: true } } } },
      },
    });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const s3Keys = [
      ...device.attachments.map((a: { fileKey: string }) => a.fileKey),
      ...device.maintenanceRecords.flatMap((r: { attachments: { fileKey: string }[] }) => r.attachments.map((a: { fileKey: string }) => a.fileKey)),
    ];

    await prisma.device.delete({ where: { id: req.params.id as string } });

    if (s3Keys.length > 0) {
      try { await deleteFiles(s3Keys); } catch (e: unknown) { console.warn('S3 cleanup warning:', (e as Error).message); }
    }

    res.status(204).send();
  } catch (err) {
    console.error('Delete device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/devices/:id/qrcode — serve QR code PNG
router.get('/:id/qrcode', async (req: Request, res: Response) => {
  try {
    const device = await prisma.device.findUnique({
      where: { id: req.params.id as string },
      select: { qrcode: true },
    });
    if (!device?.qrcode) return res.status(404).json({ error: 'QR code not found' });
    res.set('Content-Type', 'image/png');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(Buffer.from(device.qrcode));
  } catch (err) {
    console.error('Get QR code error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

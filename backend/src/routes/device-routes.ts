import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import prisma from '../lib/prisma-client.js';
import { mapDevice } from '../utils/response-mapper.js';
import { generateQrCode } from '../utils/qrcode-generator.js';
import { syncDeviceTransferRecord } from '../utils/transfer-records.js';
import { validateTypeStatus, applyDateStatusRules, type StatusData } from '../utils/device-status-rules.js';
import { uploadFile, deleteFile, deleteFiles } from '../lib/s3-client.js';
import { requirePermission } from '../middleware/require-permission.js';

const router: ReturnType<typeof Router> = Router();

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ATTACHMENT_MIMES = [...IMAGE_MIMES, 'application/pdf'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'primary_image') {
      if (IMAGE_MIMES.includes(file.mimetype)) cb(null, true);
      else cb(new Error('Primary image must be JPEG, PNG, WebP, or GIF') as unknown as null, false);
    } else if (file.fieldname === 'attachments') {
      if (ATTACHMENT_MIMES.includes(file.mimetype)) cb(null, true);
      else cb(new Error('Attachments must be images or PDF') as unknown as null, false);
    } else {
      cb(null, true);
    }
  },
});

const deviceUpload = upload.fields([
  { name: 'primary_image', maxCount: 1 },
  { name: 'attachments', maxCount: 9 },
]);

const listDeviceIncludes = {
  location: true,
  attachments: { where: { isPrimary: true }, select: { id: true, isPrimary: true }, take: 1 },
};

const detailDeviceIncludes = {
  ...listDeviceIncludes,
  transferRecord: {
    include: {
      attachments: {
        orderBy: { createdAt: 'asc' as const },
      },
    },
  },
};

// Helper: get location-based where clause for USER role
async function getUserLocationFilter(req: Request): Promise<Record<string, unknown> | null> {
  if (req.user!.role !== 'USER') return null; // SADMIN/ADMIN see all
  const assignments = await prisma.userLocation.findMany({
    where: { userId: req.user!.id },
    include: { location: true },
  });
  const locationIds = assignments.map(a => a.locationId);
  const locationNames = assignments.map(a => a.location.name);
  return {
    OR: [
      { locationId: { in: locationIds } },
      { transferTo: { in: locationNames } },
    ],
  };
}

// POST /api/devices/bulk-delete — delete multiple devices
router.post('/bulk-delete', requirePermission('devices', 'delete'), async (req: Request, res: Response) => {
  try {
    const { ids } = req.body as { ids?: string[] };
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array is required' });
    if (ids.length > 100) return res.status(400).json({ error: 'Maximum 100 devices per bulk delete' });

    // Gather S3 keys before deletion
    const devices = await prisma.device.findMany({
      where: { id: { in: ids } },
      include: {
        attachments: { select: { fileKey: true } },
        transferRecord: { include: { attachments: { select: { fileKey: true } } } },
        maintenanceRecords: { include: { attachments: { select: { fileKey: true } } } },
      },
    });

    const s3Keys = devices.flatMap(d => [
      ...d.attachments.map((a: { fileKey: string }) => a.fileKey),
      ...(d.transferRecord?.attachments.map((a: { fileKey: string }) => a.fileKey) || []),
      ...d.maintenanceRecords.flatMap((r: { attachments: { fileKey: string }[] }) => r.attachments.map((a: { fileKey: string }) => a.fileKey)),
    ]);

    const result = await prisma.device.deleteMany({ where: { id: { in: ids } } });

    if (s3Keys.length > 0) {
      try { await deleteFiles(s3Keys); } catch (e: unknown) { console.warn('S3 bulk cleanup warning:', (e as Error).message); }
    }

    res.json({ deleted: result.count });
  } catch (err) {
    console.error('Bulk delete devices error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/devices/bulk-edit — update status and/or transfer fields on multiple devices
router.post('/bulk-edit', requirePermission('devices', 'update'), async (req: Request, res: Response) => {
  try {
    const { ids, status, owned_by, transfer_to, transfer_date } = req.body as {
      ids?: string[];
      status?: string;
      owned_by?: string;
      transfer_to?: string | null;
      transfer_date?: string | null;
    };
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array is required' });
    if (ids.length > 100) return res.status(400).json({ error: 'Maximum 100 devices per bulk edit' });

    const hasStatusChange = status !== undefined && status !== '';
    const hasTransferChange = owned_by !== undefined || transfer_to !== undefined || transfer_date !== undefined;
    if (!hasStatusChange && !hasTransferChange) return res.status(400).json({ error: 'Nothing to update' });

    const devices = await prisma.device.findMany({ where: { id: { in: ids } }, select: { id: true, type: true, status: true } });
    if (devices.length === 0) return res.status(404).json({ error: 'No devices found' });

    const errors: string[] = [];
    const validIds: string[] = [];

    // Validate status per device type
    for (const device of devices) {
      if (hasStatusChange) {
        const err = validateTypeStatus(device.type, status!);
        if (err) {
          errors.push(`${device.id}: ${err}`);
          continue;
        }
      }
      validIds.push(device.id);
    }

    if (validIds.length === 0) return res.status(400).json({ error: 'No valid devices to update', details: errors });

    // Build update payload
    const updateData: Record<string, unknown> = { updatedById: req.user!.id };
    if (hasStatusChange) updateData.status = status;
    if (owned_by !== undefined) updateData.ownedBy = owned_by.trim();
    if (transfer_to !== undefined) updateData.transferTo = transfer_to ? transfer_to.trim() : null;
    if (transfer_date !== undefined) updateData.transferDate = transfer_date ? new Date(transfer_date) : null;

    await prisma.$transaction(async (tx) => {
      await tx.device.updateMany({ where: { id: { in: validIds } }, data: updateData });

      // Sync transfer records if transfer fields changed
      if (hasTransferChange) {
        for (const deviceId of validIds) {
          const device = devices.find(d => d.id === deviceId)!;
          const transferSummary = {
            ownedBy: owned_by !== undefined ? owned_by.trim() : '',
            transferTo: transfer_to !== undefined ? (transfer_to ? transfer_to.trim() : null) : null,
            transferDate: transfer_date !== undefined ? (transfer_date ? new Date(transfer_date) : null) : null,
          };
          await syncDeviceTransferRecord(deviceId, transferSummary, tx);
        }
      }
    });

    res.json({ updated: validIds.length, errors });
  } catch (err) {
    console.error('Bulk edit devices error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/devices — list all devices
router.get('/', requirePermission('devices', 'view'), async (req: Request, res: Response) => {
  try {
    const { type, status } = req.query as { type?: string; status?: string };
    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (status) where.status = status;

    // Filter by user's assigned locations for USER role
    const locationFilter = await getUserLocationFilter(req);
    if (locationFilter) {
      where.AND = [locationFilter];
    }

    const devices = await prisma.device.findMany({
      where,
      include: listDeviceIncludes,
      orderBy: { createdAt: 'desc' },
    });
    res.json(devices.map(mapDevice));
  } catch (err) {
    console.error('List devices error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/devices/:id — get device detail
router.get('/:id', requirePermission('devices', 'view'), async (req: Request, res: Response) => {
  try {
    const device = await prisma.device.findUnique({
      where: { id: req.params.id as string },
      include: detailDeviceIncludes,
    });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    // Check location access for USER role
    const locationFilter = await getUserLocationFilter(req);
    if (locationFilter) {
      const orConditions = (locationFilter as { OR: Array<Record<string, unknown>> }).OR;
      const locationIds = (orConditions[0].locationId as { in: string[] }).in;
      const locationNames = (orConditions[1].transferTo as { in: string[] }).in;
      const hasAccess = locationIds.includes(device.locationId || '') || locationNames.includes(device.transferTo || '');
      if (!hasAccess) return res.status(404).json({ error: 'Device not found' });
    }

    res.json(mapDevice(device));
  } catch (err) {
    console.error('Get device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/devices — create device
router.post('/', requirePermission('devices', 'create'), deviceUpload, async (req: Request, res: Response) => {
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
    const transferSummary = {
      ownedBy: owned_by?.trim() || '',
      transferTo: transfer_to?.trim() || null,
      transferDate: transfer_date ? new Date(transfer_date) : null,
    };

    await prisma.$transaction(async (tx) => {
      await tx.device.create({
        data: {
          id,
          storeId: store_id.trim(),
          name: name.trim(),
          locationId: location_id.trim(),
          managedBy: managed_by?.trim() || '',
          ownedBy: transferSummary.ownedBy,
          serialNumber: serial_number?.trim() || '',
          model: deviceModel?.trim() || '',
          manufacturer: manufacturer?.trim() || '',
          description: description?.trim() || '',
          qrcode: new Uint8Array(qrcode),
          type: statusData.type,
          status: statusData.status,
          disposalDate: statusData.disposalDate,
          lossDate: statusData.lossDate,
          transferTo: transferSummary.transferTo,
          transferDate: transferSummary.transferDate,
          createdById: req.user!.id,
        },
      });
      await syncDeviceTransferRecord(id, transferSummary, tx);
    });

    // Upload primary image and attachments to S3
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const primaryFile = files?.primary_image?.[0];
    const attachmentFiles = files?.attachments || [];

    if (primaryFile) {
      const attachmentId = uuidv4();
      const ext = path.extname(primaryFile.originalname) || '.jpg';
      const key = `devices/${id}/${attachmentId}${ext}`;
      await uploadFile(key, primaryFile.buffer, primaryFile.mimetype);
      await prisma.attachment.create({
        data: { id: attachmentId, deviceId: id, fileKey: key, fileName: primaryFile.originalname, fileType: primaryFile.mimetype, fileSize: primaryFile.size, isPrimary: true },
      });
    }

    for (const file of attachmentFiles) {
      const attachmentId = uuidv4();
      const ext = path.extname(file.originalname) || '.bin';
      const key = `devices/${id}/${attachmentId}${ext}`;
      await uploadFile(key, file.buffer, file.mimetype);
      await prisma.attachment.create({
        data: { id: attachmentId, deviceId: id, fileKey: key, fileName: file.originalname, fileType: file.mimetype, fileSize: file.size, isPrimary: false },
      });
    }

    // Re-fetch to include new attachments
    const updated = await prisma.device.findUnique({ where: { id }, include: detailDeviceIncludes });
    res.status(201).json(mapDevice(updated!));
  } catch (err) {
    console.error('Create device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/devices/:id — update device
router.put('/:id', requirePermission('devices', 'update'), deviceUpload, async (req: Request, res: Response) => {
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
    const transferSummary = {
      ownedBy: owned_by?.trim() || '',
      transferTo: transfer_to?.trim() || null,
      transferDate: transfer_date ? new Date(transfer_date) : null,
    };

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
      transferTo: transferSummary.transferTo,
      transferDate: transferSummary.transferDate,
      updatedById: req.user!.id,
    };

    await prisma.$transaction(async (tx) => {
      await tx.device.update({
        where: { id: req.params.id as string },
        data: updateData,
      });
      await syncDeviceTransferRecord(req.params.id as string, transferSummary, tx);
    });

    // Handle primary image upload (replace old primary)
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const primaryFile = files?.primary_image?.[0];
    const attachmentFiles = files?.attachments || [];

    if (primaryFile) {
      const oldPrimary = await prisma.attachment.findFirst({ where: { deviceId: req.params.id as string, isPrimary: true } });
      if (oldPrimary) {
        await prisma.attachment.delete({ where: { id: oldPrimary.id } });
        try { await deleteFile(oldPrimary.fileKey); } catch (e: unknown) { console.warn('S3 delete warning:', (e as Error).message); }
      }
      const attachmentId = uuidv4();
      const ext = path.extname(primaryFile.originalname) || '.jpg';
      const key = `devices/${req.params.id}/${attachmentId}${ext}`;
      await uploadFile(key, primaryFile.buffer, primaryFile.mimetype);
      await prisma.attachment.create({
        data: { id: attachmentId, deviceId: req.params.id as string, fileKey: key, fileName: primaryFile.originalname, fileType: primaryFile.mimetype, fileSize: primaryFile.size, isPrimary: true },
      });
    }

    // Handle additional attachments
    if (attachmentFiles.length > 0) {
      const existingCount = await prisma.attachment.count({ where: { deviceId: req.params.id as string } });
      if (existingCount + attachmentFiles.length > 10) {
        return res.status(400).json({ error: 'Maximum 10 attachments per device' });
      }
      for (const file of attachmentFiles) {
        const attachmentId = uuidv4();
        const ext = path.extname(file.originalname) || '.bin';
        const key = `devices/${req.params.id}/${attachmentId}${ext}`;
        await uploadFile(key, file.buffer, file.mimetype);
        await prisma.attachment.create({
          data: { id: attachmentId, deviceId: req.params.id as string, fileKey: key, fileName: file.originalname, fileType: file.mimetype, fileSize: file.size, isPrimary: false },
        });
      }
    }

    const device = await prisma.device.findUnique({ where: { id: req.params.id as string }, include: detailDeviceIncludes });
    res.json(mapDevice(device!));
  } catch (err) {
    console.error('Update device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/devices/:id — delete device + S3 cleanup
router.delete('/:id', requirePermission('devices', 'delete'), async (req: Request, res: Response) => {
  try {
    const device = await prisma.device.findUnique({
      where: { id: req.params.id as string },
      include: {
        attachments: { select: { fileKey: true } },
        transferRecord: { include: { attachments: { select: { fileKey: true } } } },
        maintenanceRecords: { include: { attachments: { select: { fileKey: true } } } },
      },
    });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const s3Keys = [
      ...device.attachments.map((a: { fileKey: string }) => a.fileKey),
      ...(device.transferRecord?.attachments.map((a: { fileKey: string }) => a.fileKey) || []),
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
router.get('/:id/qrcode', requirePermission('devices', 'view'), async (req: Request, res: Response) => {
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

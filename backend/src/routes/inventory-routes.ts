import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import prisma from '../lib/prisma-client.js';
import { uploadFile, downloadFile, deleteFile, deleteFiles } from '../lib/s3-client.js';
import { requirePermission } from '../middleware/require-permission.js';
import { recomputeDeviceStatus } from '../utils/device-status-sync.js';

const router: ReturnType<typeof Router> = Router();

const ALLOWED_MIMES: string[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not allowed') as unknown as null, false);
  },
});

// GET /api/devices/:deviceId/inventory — list inventory records
router.get('/devices/:deviceId/inventory', requirePermission('inventory_history', 'view'), async (req: Request, res: Response) => {
  try {
    const records = await prisma.inventoryRecord.findMany({
      where: { deviceId: req.params.deviceId as string },
      include: { attachments: true },
      orderBy: { date: 'desc' },
    });
    res.json(records.map(r => ({
      id: r.id,
      device_id: r.deviceId,
      date: r.date.toISOString(),
      description: r.description,
      technician: r.technician,
      status: r.status,
      created_at: r.createdAt.toISOString(),
      attachments: r.attachments.map(a => ({
        id: a.id, file_name: a.fileName, file_type: a.fileType, file_size: a.fileSize, created_at: a.createdAt.toISOString(),
      })),
    })));
  } catch (err) {
    console.error('List inventory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/devices/:deviceId/inventory — create inventory record (multipart with files)
router.post('/devices/:deviceId/inventory', requirePermission('inventory_history', 'create'), upload.array('files', 5), async (req: Request, res: Response) => {
  try {
    const device = await prisma.device.findUnique({ where: { id: req.params.deviceId as string } });
    if (!device) return res.status(404).json({ error: 'Device not found' });
    if (device.type !== 'tai_san') return res.status(400).json({ error: 'Inventory only for tài sản devices' });

    const { date, description, technician, status } = req.body;
    if (!date) return res.status(400).json({ error: 'Date is required' });
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });
    if (status && !['pending', 'completed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const recordId = uuidv4();
    const record = await prisma.inventoryRecord.create({
      data: {
        id: recordId,
        deviceId: req.params.deviceId as string,
        date: new Date(date),
        description: description.trim(),
        technician: technician?.trim() || '',
        status: status || 'pending',
        createdById: req.user!.id,
      },
    });

    const files = req.files as Express.Multer.File[] | undefined;
    const createdAttachments = [];
    if (files?.length) {
      for (const file of files) {
        const attachmentId = uuidv4();
        const ext = path.extname(file.originalname) || '.bin';
        const key = `inventory/${recordId}/${attachmentId}${ext}`;
        await uploadFile(key, file.buffer, file.mimetype);
        const attachment = await prisma.inventoryAttachment.create({
          data: { id: attachmentId, inventoryId: recordId, fileKey: key, fileName: file.originalname, fileType: file.mimetype, fileSize: file.size },
        });
        createdAttachments.push(attachment);
      }
    }

    // Completion side-effects: revert device.inventoryStatus to 'in_use' and
    // advance the recurring schedule if one exists.
    if (record.status === 'completed') {
      const completedAt = record.date;
      await prisma.device.update({
        where: { id: req.params.deviceId as string },
        data: { inventoryStatus: 'in_use' },
      });
      const sched = await prisma.scheduledInventory.findUnique({ where: { deviceId: req.params.deviceId as string } });
      if (sched) {
        const next = new Date(completedAt);
        next.setDate(next.getDate() + sched.intervalDays);
        await prisma.scheduledInventory.update({
          where: { id: sched.id },
          data: {
            lastInventoryAt: completedAt,
            nextDueAt: next,
            lastNotifiedAt: null,
            updatedById: req.user!.id,
          },
        });
      }
    }

    await recomputeDeviceStatus(req.params.deviceId as string);

    res.status(201).json({
      id: record.id, device_id: record.deviceId, date: record.date.toISOString(),
      description: record.description, technician: record.technician, status: record.status,
      created_at: record.createdAt.toISOString(),
      attachments: createdAttachments.map(a => ({
        id: a.id, file_name: a.fileName, file_type: a.fileType, file_size: a.fileSize, created_at: a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('Create inventory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/inventory/:id — update inventory record (multipart; supports file uploads)
router.put('/inventory/:id', requirePermission('inventory_history', 'update'), upload.array('files', 5), async (req: Request, res: Response) => {
  try {
    const recordId = req.params.id as string;
    const existing = await prisma.inventoryRecord.findUnique({ where: { id: recordId } });
    if (!existing) return res.status(404).json({ error: 'Record not found' });

    const { date, description, technician, status } = req.body;
    if (status && !['pending', 'completed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const files = (req.files as Express.Multer.File[] | undefined) || [];
    if (files.length) {
      const existingCount = await prisma.inventoryAttachment.count({ where: { inventoryId: recordId } });
      if (existingCount + files.length > 5) {
        return res.status(400).json({ error: 'Maximum 5 attachments per inventory record' });
      }
      for (const file of files) {
        const attachmentId = uuidv4();
        const ext = path.extname(file.originalname) || '.bin';
        const key = `inventory/${recordId}/${attachmentId}${ext}`;
        await uploadFile(key, file.buffer, file.mimetype);
        await prisma.inventoryAttachment.create({
          data: {
            id: attachmentId,
            inventoryId: recordId,
            fileKey: key,
            fileName: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size,
            createdById: req.user!.id,
          },
        });
      }
    }

    const record = await prisma.inventoryRecord.update({
      where: { id: recordId },
      data: {
        ...(date && { date: new Date(date) }),
        ...(description?.trim() && { description: description.trim() }),
        ...(technician !== undefined && { technician: technician?.trim() || '' }),
        ...(status && { status }),
        updatedById: req.user!.id,
      },
      include: { attachments: true },
    });

    // Completion side-effects: revert inventoryStatus and advance the schedule.
    if (status === 'completed' && existing.status !== 'completed') {
      const completedAt = record.date;
      await prisma.device.update({
        where: { id: existing.deviceId },
        data: { inventoryStatus: 'in_use' },
      });
      const sched = await prisma.scheduledInventory.findUnique({ where: { deviceId: existing.deviceId } });
      if (sched) {
        const next = new Date(completedAt);
        next.setDate(next.getDate() + sched.intervalDays);
        await prisma.scheduledInventory.update({
          where: { id: sched.id },
          data: {
            lastInventoryAt: completedAt,
            nextDueAt: next,
            lastNotifiedAt: null,
            updatedById: req.user!.id,
          },
        });
      }
    }

    await recomputeDeviceStatus(existing.deviceId);

    res.json({
      id: record.id, device_id: record.deviceId, date: record.date.toISOString(),
      description: record.description, technician: record.technician, status: record.status,
      created_at: record.createdAt.toISOString(),
      attachments: record.attachments.map(a => ({
        id: a.id, file_name: a.fileName, file_type: a.fileType, file_size: a.fileSize, created_at: a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('Update inventory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/inventory/:id — delete record + S3 files
router.delete('/inventory/:id', requirePermission('inventory_history', 'delete'), async (req: Request, res: Response) => {
  try {
    const record = await prisma.inventoryRecord.findUnique({
      where: { id: req.params.id as string },
      include: { attachments: true },
    });
    if (!record) return res.status(404).json({ error: 'Record not found' });

    if (record.attachments.length) {
      try { await deleteFiles(record.attachments.map((a: { fileKey: string }) => a.fileKey)); } catch (e: unknown) { console.warn('S3 cleanup warning:', (e as Error).message); }
    }
    await prisma.inventoryRecord.delete({ where: { id: req.params.id as string } });
    await recomputeDeviceStatus(record.deviceId);
    res.status(204).send();
  } catch (err) {
    console.error('Delete inventory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/inventory/:id/attachments — upload files to record
router.post('/inventory/:id/attachments', requirePermission('inventory_history', 'create'), upload.array('files', 5), async (req: Request, res: Response) => {
  try {
    const record = await prisma.inventoryRecord.findUnique({ where: { id: req.params.id as string } });
    if (!record) return res.status(404).json({ error: 'Record not found' });

    const existingCount = await prisma.inventoryAttachment.count({ where: { inventoryId: req.params.id as string } });
    if (existingCount + ((req.files as Express.Multer.File[])?.length || 0) > 5) {
      return res.status(400).json({ error: 'Maximum 5 attachments per inventory record' });
    }

    const files = req.files as Express.Multer.File[];
    if (!files?.length) return res.status(400).json({ error: 'No files provided' });

    const created = [];
    for (const file of files) {
      const attachmentId = uuidv4();
      const ext = path.extname(file.originalname) || '.bin';
      const key = `inventory/${req.params.id}/${attachmentId}${ext}`;

      await uploadFile(key, file.buffer, file.mimetype);

      const attachment = await prisma.inventoryAttachment.create({
        data: {
          id: attachmentId,
          inventoryId: req.params.id as string,
          fileKey: key,
          fileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
        },
      });
      created.push(attachment);
    }

    res.status(201).json(created.map(a => ({
      id: a.id, file_name: a.fileName, file_type: a.fileType, file_size: a.fileSize, created_at: a.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error('Upload inventory attachments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/inventory-attachments/:id/file — stream file from S3
router.get('/inventory-attachments/:id/file', requirePermission('inventory_history', 'view'), async (req: Request, res: Response) => {
  try {
    const attachment = await prisma.inventoryAttachment.findUnique({ where: { id: req.params.id as string } });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

    const { stream, contentType } = await downloadFile(attachment.fileKey);
    res.set('Content-Type', attachment.fileType || contentType);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', `inline; filename="${attachment.fileName}"`);
    stream.pipe(res);
  } catch (err) {
    console.error('Download inventory attachment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/inventory-attachments/:id — delete single attachment
router.delete('/inventory-attachments/:id', requirePermission('inventory_history', 'delete'), async (req: Request, res: Response) => {
  try {
    const attachment = await prisma.inventoryAttachment.findUnique({ where: { id: req.params.id as string } });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

    await prisma.inventoryAttachment.delete({ where: { id: req.params.id as string } });
    try { await deleteFile(attachment.fileKey); } catch (e: unknown) { console.warn('S3 delete warning:', (e as Error).message); }
    res.status(204).send();
  } catch (err) {
    console.error('Delete inventory attachment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import prisma from '../lib/prisma-client.js';
import { uploadFile, downloadFile, deleteFile, deleteFiles } from '../lib/s3-client.js';
import { requirePermission } from '../middleware/require-permission.js';
import { syncDeviceStatusFromMaintenance } from '../utils/device-status-sync.js';

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

// GET /api/devices/:deviceId/maintenance — list maintenance records
router.get('/devices/:deviceId/maintenance', requirePermission('maintenance_history', 'view'), async (req: Request, res: Response) => {
  try {
    const records = await prisma.maintenanceRecord.findMany({
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
      record_type: r.recordType,
      created_at: r.createdAt.toISOString(),
      attachments: r.attachments.map(a => ({
        id: a.id, file_name: a.fileName, file_type: a.fileType, file_size: a.fileSize, created_at: a.createdAt.toISOString(),
      })),
    })));
  } catch (err) {
    console.error('List maintenance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/devices/:deviceId/maintenance — create maintenance record (multipart with files)
router.post('/devices/:deviceId/maintenance', requirePermission('maintenance_history', 'create'), upload.array('files', 5), async (req: Request, res: Response) => {
  try {
    const device = await prisma.device.findUnique({ where: { id: req.params.deviceId as string } });
    if (!device) return res.status(404).json({ error: 'Device not found' });
    if (device.type !== 'tai_san') return res.status(400).json({ error: 'Maintenance only for tài sản devices' });

    const { date, description, technician, status, record_type } = req.body;
    if (!date) return res.status(400).json({ error: 'Date is required' });
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });
    if (status && !['pending', 'completed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (record_type && !['maintenance', 'repair'].includes(record_type)) return res.status(400).json({ error: 'Invalid record_type' });

    const recordId = uuidv4();
    const recordType = record_type || 'repair';
    const record = await prisma.maintenanceRecord.create({
      data: {
        id: recordId,
        deviceId: req.params.deviceId as string,
        date: new Date(date),
        description: description.trim(),
        technician: technician?.trim() || '',
        status: status || 'pending',
        recordType,
        createdById: req.user!.id,
      },
    });

    // Upload attached files
    const files = req.files as Express.Multer.File[] | undefined;
    const createdAttachments = [];
    if (files?.length) {
      for (const file of files) {
        const attachmentId = uuidv4();
        const ext = path.extname(file.originalname) || '.bin';
        const key = `maintenance/${recordId}/${attachmentId}${ext}`;
        await uploadFile(key, file.buffer, file.mimetype);
        const attachment = await prisma.maintenanceAttachment.create({
          data: { id: attachmentId, maintenanceId: recordId, fileKey: key, fileName: file.originalname, fileType: file.mimetype, fileSize: file.size },
        });
        createdAttachments.push(attachment);
      }
    }

    // Completion side-effects: revert device to 'in_use' / 'active' and
    // advance the recurring schedule if one exists.
    // Only 'maintenance' type records advance the schedule; 'repair' records don't.
    if (record.status === 'completed' && recordType === 'maintenance') {
      const completedAt = record.date;
      const existingDevice = await prisma.device.findUnique({ where: { id: req.params.deviceId as string } });
      if (existingDevice) {
        await prisma.device.update({
          where: { id: existingDevice.id },
          data: {
            maintenanceStatus: 'in_use',
            ...(existingDevice.status === 'under_repair' ? { status: 'active' } : {}),
          },
        });
      }
      const sched = await prisma.scheduledMaintenance.findUnique({ where: { deviceId: req.params.deviceId as string } });
      if (sched) {
        const next = new Date(completedAt);
        next.setDate(next.getDate() + sched.intervalDays);
        await prisma.scheduledMaintenance.update({
          where: { id: sched.id },
          data: {
            lastMaintenanceAt: completedAt,
            nextDueAt: next,
            lastNotifiedAt: null,
            updatedById: req.user!.id,
          },
        });
      }
    }

    await syncDeviceStatusFromMaintenance(req.params.deviceId as string);

    res.status(201).json({
      id: record.id, device_id: record.deviceId, date: record.date.toISOString(),
      description: record.description, technician: record.technician, status: record.status,
      record_type: record.recordType,
      created_at: record.createdAt.toISOString(),
      attachments: createdAttachments.map(a => ({
        id: a.id, file_name: a.fileName, file_type: a.fileType, file_size: a.fileSize, created_at: a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('Create maintenance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/maintenance/:id — update maintenance record (multipart; supports file uploads)
router.put('/maintenance/:id', requirePermission('maintenance_history', 'update'), upload.array('files', 5), async (req: Request, res: Response) => {
  try {
    const recordId = req.params.id as string;
    const existing = await prisma.maintenanceRecord.findUnique({ where: { id: recordId } });
    if (!existing) return res.status(404).json({ error: 'Record not found' });

    const { date, description, technician, status, record_type } = req.body;
    if (status && !['pending', 'completed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (record_type && !['maintenance', 'repair'].includes(record_type)) return res.status(400).json({ error: 'Invalid record_type' });

    // Upload any incoming files first (max 5 total per record).
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    if (files.length) {
      const existingCount = await prisma.maintenanceAttachment.count({ where: { maintenanceId: recordId } });
      if (existingCount + files.length > 5) {
        return res.status(400).json({ error: 'Maximum 5 attachments per maintenance record' });
      }
      for (const file of files) {
        const attachmentId = uuidv4();
        const ext = path.extname(file.originalname) || '.bin';
        const key = `maintenance/${recordId}/${attachmentId}${ext}`;
        await uploadFile(key, file.buffer, file.mimetype);
        await prisma.maintenanceAttachment.create({
          data: {
            id: attachmentId,
            maintenanceId: recordId,
            fileKey: key,
            fileName: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size,
            createdById: req.user!.id,
          },
        });
      }
    }

    const record = await prisma.maintenanceRecord.update({
      where: { id: recordId },
      data: {
        ...(date && { date: new Date(date) }),
        ...(description?.trim() && { description: description.trim() }),
        ...(technician !== undefined && { technician: technician?.trim() || '' }),
        ...(status && { status }),
        ...(record_type && { recordType: record_type }),
        updatedById: req.user!.id,
      },
      include: { attachments: true },
    });

    // Completion side-effects: revert device to 'in_use' / 'active' and
    // advance the recurring schedule if one exists.
    // Only 'maintenance' type records advance the schedule; 'repair' records don't.
    if (status === 'completed' && existing.status !== 'completed' && record.recordType === 'maintenance') {
      const completedAt = record.date;
      const device = await prisma.device.findUnique({ where: { id: existing.deviceId } });
      if (device) {
        await prisma.device.update({
          where: { id: device.id },
          data: {
            maintenanceStatus: 'in_use',
            ...(device.status === 'under_repair' ? { status: 'active' } : {}),
          },
        });
      }
      const sched = await prisma.scheduledMaintenance.findUnique({ where: { deviceId: existing.deviceId } });
      if (sched) {
        const next = new Date(completedAt);
        next.setDate(next.getDate() + sched.intervalDays);
        await prisma.scheduledMaintenance.update({
          where: { id: sched.id },
          data: {
            lastMaintenanceAt: completedAt,
            nextDueAt: next,
            lastNotifiedAt: null,
            updatedById: req.user!.id,
          },
        });
      }
    }

    // Re-evaluate device.status from the full pending-record set. Corrects
    // edge cases the dedicated completion branch above can't see: completing
    // one record while OTHERS remain pending, or re-opening a completed record.
    await syncDeviceStatusFromMaintenance(existing.deviceId);

    res.json({
      id: record.id, device_id: record.deviceId, date: record.date.toISOString(),
      description: record.description, technician: record.technician, status: record.status,
      record_type: record.recordType,
      created_at: record.createdAt.toISOString(),
      attachments: record.attachments.map(a => ({
        id: a.id, file_name: a.fileName, file_type: a.fileType, file_size: a.fileSize, created_at: a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('Update maintenance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/maintenance/:id — delete record + S3 files
router.delete('/maintenance/:id', requirePermission('maintenance_history', 'delete'), async (req: Request, res: Response) => {
  try {
    const record = await prisma.maintenanceRecord.findUnique({
      where: { id: req.params.id as string },
      include: { attachments: true },
    });
    if (!record) return res.status(404).json({ error: 'Record not found' });

    if (record.attachments.length) {
      try { await deleteFiles(record.attachments.map((a: { fileKey: string }) => a.fileKey)); } catch (e: unknown) { console.warn('S3 cleanup warning:', (e as Error).message); }
    }
    await prisma.maintenanceRecord.delete({ where: { id: req.params.id as string } });
    await syncDeviceStatusFromMaintenance(record.deviceId);
    res.status(204).send();
  } catch (err) {
    console.error('Delete maintenance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/maintenance/:id/attachments — upload files to record
router.post('/maintenance/:id/attachments', requirePermission('maintenance_history', 'create'), upload.array('files', 5), async (req: Request, res: Response) => {
  try {
    const record = await prisma.maintenanceRecord.findUnique({ where: { id: req.params.id as string } });
    if (!record) return res.status(404).json({ error: 'Record not found' });

    const existingCount = await prisma.maintenanceAttachment.count({ where: { maintenanceId: req.params.id as string } });
    if (existingCount + ((req.files as Express.Multer.File[])?.length || 0) > 5) {
      return res.status(400).json({ error: 'Maximum 5 attachments per maintenance record' });
    }

    const files = req.files as Express.Multer.File[];
    if (!files?.length) return res.status(400).json({ error: 'No files provided' });

    const created = [];
    for (const file of files) {
      const attachmentId = uuidv4();
      const ext = path.extname(file.originalname) || '.bin';
      const key = `maintenance/${req.params.id}/${attachmentId}${ext}`;

      await uploadFile(key, file.buffer, file.mimetype);

      const attachment = await prisma.maintenanceAttachment.create({
        data: {
          id: attachmentId,
          maintenanceId: req.params.id as string,
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
    console.error('Upload maintenance attachments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/maintenance-attachments/:id/file — stream file from S3
router.get('/maintenance-attachments/:id/file', requirePermission('maintenance_history', 'view'), async (req: Request, res: Response) => {
  try {
    const attachment = await prisma.maintenanceAttachment.findUnique({ where: { id: req.params.id as string } });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

    const { stream, contentType } = await downloadFile(attachment.fileKey);
    res.set('Content-Type', attachment.fileType || contentType);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', `inline; filename="${attachment.fileName}"`);
    stream.pipe(res);
  } catch (err) {
    console.error('Download maintenance attachment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/maintenance-attachments/:id — delete single attachment
router.delete('/maintenance-attachments/:id', requirePermission('maintenance_history', 'delete'), async (req: Request, res: Response) => {
  try {
    const attachment = await prisma.maintenanceAttachment.findUnique({ where: { id: req.params.id as string } });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

    await prisma.maintenanceAttachment.delete({ where: { id: req.params.id as string } });
    try { await deleteFile(attachment.fileKey); } catch (e: unknown) { console.warn('S3 delete warning:', (e as Error).message); }
    res.status(204).send();
  } catch (err) {
    console.error('Delete maintenance attachment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

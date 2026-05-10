import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import prisma from '../lib/prisma-client.js';
import { uploadFile, downloadFile, deleteFile, deleteFiles } from '../lib/s3-client.js';
import { requirePermission } from '../middleware/require-permission.js';

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

interface TaskAttachmentRow { id: string; fileName: string; fileType: string; fileSize: number; createdAt: Date; }
interface TaskRow {
  id: string; deviceId: string; date: Date; description: string;
  technician: string; status: string; createdAt: Date;
  attachments: TaskAttachmentRow[];
}

function mapTask(r: TaskRow) {
  return {
    id: r.id,
    device_id: r.deviceId,
    date: r.date.toISOString(),
    description: r.description,
    technician: r.technician,
    status: r.status,
    created_at: r.createdAt.toISOString(),
    attachments: r.attachments.map(a => ({
      id: a.id, file_name: a.fileName, file_type: a.fileType, file_size: a.fileSize,
      created_at: a.createdAt.toISOString(),
    })),
  };
}

// Resolve a {week|month|year} window into [from, to] Date pair anchored on `now`.
function rangeFromPeriod(period: string | undefined, anchor: Date): { from: Date; to: Date } | null {
  if (!period) return null;
  const to = new Date(anchor);
  const from = new Date(anchor);
  if (period === 'week') { from.setDate(from.getDate() - 7); }
  else if (period === 'month') { from.setMonth(from.getMonth() - 1); }
  else if (period === 'year') { from.setFullYear(from.getFullYear() - 1); }
  else return null;
  return { from, to };
}

// GET /api/devices/:deviceId/maintenance-tasks?period=week|month|year
router.get('/devices/:deviceId/maintenance-tasks', requirePermission('maintenance', 'view'), async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId as string;
    const period = req.query.period as string | undefined;
    const where: Record<string, unknown> = { deviceId };
    const range = rangeFromPeriod(period, new Date());
    if (range) where.date = { gte: range.from, lte: range.to };

    const tasks = await prisma.maintenanceTask.findMany({
      where,
      include: { attachments: true },
      orderBy: { date: 'desc' },
    });
    res.json(tasks.map(mapTask));
  } catch (err) {
    console.error('List maintenance tasks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/devices/:deviceId/maintenance-tasks
router.post('/devices/:deviceId/maintenance-tasks', requirePermission('maintenance', 'create'), upload.array('files', 5), async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId as string;
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) return res.status(404).json({ error: 'Device not found' });
    if (device.type !== 'tai_san') return res.status(400).json({ error: 'Maintenance only for tài sản devices' });

    const { date, description, technician, status } = req.body;
    if (!date) return res.status(400).json({ error: 'Date is required' });
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });
    if (status && !['pending', 'completed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const taskId = uuidv4();
    const task = await prisma.maintenanceTask.create({
      data: {
        id: taskId,
        deviceId,
        date: new Date(date),
        description: description.trim(),
        technician: technician?.trim() || '',
        status: status || 'pending',
        createdById: req.user!.id,
      },
    });

    const files = (req.files as Express.Multer.File[] | undefined) || [];
    const createdAttachments: TaskAttachmentRow[] = [];
    for (const file of files) {
      const attachmentId = uuidv4();
      const ext = path.extname(file.originalname) || '.bin';
      const key = `maintenance-tasks/${taskId}/${attachmentId}${ext}`;
      await uploadFile(key, file.buffer, file.mimetype);
      const att = await prisma.maintenanceTaskAttachment.create({
        data: { id: attachmentId, taskId, fileKey: key, fileName: file.originalname, fileType: file.mimetype, fileSize: file.size },
      });
      createdAttachments.push(att);
    }

    // If status is 'completed' and a schedule exists, advance nextDueAt and clear lastNotifiedAt
    // and reset device.maintenance_status to 'in_use'.
    if ((status || 'pending') === 'completed') {
      const sched = await prisma.scheduledMaintenance.findUnique({ where: { deviceId } });
      if (sched) {
        const nextDue = new Date(task.date);
        nextDue.setDate(nextDue.getDate() + sched.intervalDays);
        await prisma.scheduledMaintenance.update({
          where: { deviceId },
          data: { nextDueAt: nextDue, lastMaintenanceAt: task.date, lastNotifiedAt: null, updatedById: req.user!.id },
        });
      }
      await prisma.device.update({ where: { id: deviceId }, data: { maintenanceStatus: 'in_use' } });
      // Revert user-facing status only if the scheduler had auto-flipped it to 'under_repair'.
      await prisma.device.updateMany({ where: { id: deviceId, status: 'under_repair' }, data: { status: 'active' } });
    }

    res.status(201).json(mapTask({ ...task, attachments: createdAttachments }));
  } catch (err) {
    console.error('Create maintenance task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/maintenance-tasks/:id — update
router.put('/maintenance-tasks/:id', requirePermission('maintenance', 'update'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.maintenanceTask.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const { date, description, technician, status } = req.body;
    if (status && !['pending', 'completed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const updated = await prisma.maintenanceTask.update({
      where: { id },
      data: {
        ...(date && { date: new Date(date) }),
        ...(description?.trim() && { description: description.trim() }),
        ...(technician !== undefined && { technician: technician?.trim() || '' }),
        ...(status && { status }),
        updatedById: req.user!.id,
      },
      include: { attachments: true },
    });

    // Same "completed" side-effects as create
    if (status === 'completed') {
      const sched = await prisma.scheduledMaintenance.findUnique({ where: { deviceId: updated.deviceId } });
      if (sched) {
        const nextDue = new Date(updated.date);
        nextDue.setDate(nextDue.getDate() + sched.intervalDays);
        await prisma.scheduledMaintenance.update({
          where: { deviceId: updated.deviceId },
          data: { nextDueAt: nextDue, lastMaintenanceAt: updated.date, lastNotifiedAt: null, updatedById: req.user!.id },
        });
      }
      await prisma.device.update({ where: { id: updated.deviceId }, data: { maintenanceStatus: 'in_use' } });
      // Revert user-facing status only if the scheduler had auto-flipped it to 'under_repair'.
      await prisma.device.updateMany({ where: { id: updated.deviceId, status: 'under_repair' }, data: { status: 'active' } });
    }

    res.json(mapTask(updated));
  } catch (err) {
    console.error('Update maintenance task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/maintenance-tasks/:id
router.delete('/maintenance-tasks/:id', requirePermission('maintenance', 'delete'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const task = await prisma.maintenanceTask.findUnique({ where: { id }, include: { attachments: true } });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.attachments.length) {
      try { await deleteFiles(task.attachments.map((a: { fileKey: string }) => a.fileKey)); }
      catch (e: unknown) { console.warn('S3 cleanup warning:', (e as Error).message); }
    }
    await prisma.maintenanceTask.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error('Delete maintenance task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/maintenance-tasks/:id/attachments — upload extra files
router.post('/maintenance-tasks/:id/attachments', requirePermission('maintenance', 'create'), upload.array('files', 5), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const task = await prisma.maintenanceTask.findUnique({ where: { id } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const existingCount = await prisma.maintenanceTaskAttachment.count({ where: { taskId: id } });
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    if (!files.length) return res.status(400).json({ error: 'No files provided' });
    if (existingCount + files.length > 5) return res.status(400).json({ error: 'Maximum 5 attachments per task' });

    const created: TaskAttachmentRow[] = [];
    for (const file of files) {
      const attachmentId = uuidv4();
      const ext = path.extname(file.originalname) || '.bin';
      const key = `maintenance-tasks/${id}/${attachmentId}${ext}`;
      await uploadFile(key, file.buffer, file.mimetype);
      const att = await prisma.maintenanceTaskAttachment.create({
        data: { id: attachmentId, taskId: id, fileKey: key, fileName: file.originalname, fileType: file.mimetype, fileSize: file.size },
      });
      created.push(att);
    }
    res.status(201).json(created.map(a => ({
      id: a.id, file_name: a.fileName, file_type: a.fileType, file_size: a.fileSize, created_at: a.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error('Upload task attachments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/maintenance-task-attachments/:id/file
router.get('/maintenance-task-attachments/:id/file', requirePermission('maintenance', 'view'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const att = await prisma.maintenanceTaskAttachment.findUnique({ where: { id } });
    if (!att) return res.status(404).json({ error: 'Attachment not found' });
    const { stream, contentType } = await downloadFile(att.fileKey);
    res.set('Content-Type', att.fileType || contentType);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', `inline; filename="${att.fileName}"`);
    stream.pipe(res);
  } catch (err) {
    console.error('Download task attachment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/maintenance-task-attachments/:id
router.delete('/maintenance-task-attachments/:id', requirePermission('maintenance', 'delete'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const att = await prisma.maintenanceTaskAttachment.findUnique({ where: { id } });
    if (!att) return res.status(404).json({ error: 'Attachment not found' });
    await prisma.maintenanceTaskAttachment.delete({ where: { id } });
    try { await deleteFile(att.fileKey); } catch (e: unknown) { console.warn('S3 delete warning:', (e as Error).message); }
    res.status(204).send();
  } catch (err) {
    console.error('Delete task attachment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

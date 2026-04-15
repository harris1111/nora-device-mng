import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import prisma from '../lib/prisma-client.js';
import { uploadFile, downloadFile, deleteFile } from '../lib/s3-client.js';
import { requirePermission } from '../middleware/require-permission.js';

const router: ReturnType<typeof Router> = Router();

const ALLOWED_MIMES: string[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const MAX_PER_DEVICE: number = 10;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not allowed') as unknown as null, false);
  },
});

// GET /api/devices/:deviceId/attachments — list device attachments
router.get('/devices/:deviceId/attachments', requirePermission('attachments', 'view'), async (req: Request, res: Response) => {
  try {
    const attachments = await prisma.attachment.findMany({
      where: { deviceId: req.params.deviceId as string },
      orderBy: { createdAt: 'asc' },
    });
    res.json(attachments.map(a => ({
      id: a.id,
      device_id: a.deviceId,
      file_name: a.fileName,
      file_type: a.fileType,
      file_size: a.fileSize,
      is_primary: a.isPrimary,
      created_at: a.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error('List attachments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/devices/:deviceId/attachments — upload files
router.post('/devices/:deviceId/attachments', requirePermission('attachments', 'create'), upload.array('files', 5), async (req: Request, res: Response) => {
  try {
    const device = await prisma.device.findUnique({ where: { id: req.params.deviceId as string } });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const existingCount = await prisma.attachment.count({ where: { deviceId: req.params.deviceId as string } });
    const files = req.files as Express.Multer.File[];
    if (existingCount + (files?.length || 0) > MAX_PER_DEVICE) {
      return res.status(400).json({ error: `Maximum ${MAX_PER_DEVICE} attachments per device` });
    }

    if (!files?.length) return res.status(400).json({ error: 'No files provided' });

    const isFirst = existingCount === 0;
    const created = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const attachmentId = uuidv4();
      const ext = path.extname(file.originalname) || '.bin';
      const key = `devices/${req.params.deviceId}/${attachmentId}${ext}`;

      await uploadFile(key, file.buffer, file.mimetype);

      const attachment = await prisma.attachment.create({
        data: {
          id: attachmentId,
          deviceId: req.params.deviceId as string,
          fileKey: key,
          fileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          isPrimary: isFirst && i === 0,
        },
      });
      created.push(attachment);
    }

    res.status(201).json(created.map(a => ({
      id: a.id, device_id: a.deviceId, file_name: a.fileName,
      file_type: a.fileType, file_size: a.fileSize, is_primary: a.isPrimary,
      created_at: a.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error('Upload attachments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attachments/:id/file — stream file from S3
router.get('/attachments/:id/file', requirePermission('attachments', 'view'), async (req: Request, res: Response) => {
  try {
    const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id as string } });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

    const { stream, contentType } = await downloadFile(attachment.fileKey);
    res.set('Content-Type', attachment.fileType || contentType);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', `inline; filename="${attachment.fileName}"`);
    stream.pipe(res);
  } catch (err) {
    console.error('Download attachment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/attachments/:id — delete attachment + S3 object
router.delete('/attachments/:id', requirePermission('attachments', 'delete'), async (req: Request, res: Response) => {
  try {
    const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id as string } });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

    await prisma.attachment.delete({ where: { id: req.params.id as string } });
    try { await deleteFile(attachment.fileKey); } catch (e: unknown) { console.warn('S3 delete warning:', (e as Error).message); }

    // If deleted was primary, promote the oldest remaining
    if (attachment.isPrimary) {
      const next = await prisma.attachment.findFirst({
        where: { deviceId: attachment.deviceId },
        orderBy: { createdAt: 'asc' },
      });
      if (next) {
        await prisma.attachment.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
    }

    res.status(204).send();
  } catch (err) {
    console.error('Delete attachment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/attachments/:id/primary — set as primary attachment
router.patch('/attachments/:id/primary', requirePermission('attachments', 'update'), async (req: Request, res: Response) => {
  try {
    const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id as string } });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

    await prisma.$transaction([
      prisma.attachment.updateMany({ where: { deviceId: attachment.deviceId }, data: { isPrimary: false } }),
      prisma.attachment.update({ where: { id: req.params.id as string }, data: { isPrimary: true } }),
    ]);

    res.json({ id: attachment.id, is_primary: true });
  } catch (err) {
    console.error('Set primary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

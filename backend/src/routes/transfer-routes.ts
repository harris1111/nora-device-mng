import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { Prisma } from '../generated/prisma/client.js';
import prisma from '../lib/prisma-client.js';
import { cleanupTransferRecordIfEmpty, ensureTransferRecordForDevice } from '../utils/transfer-records.js';
import { uploadFile, downloadFile, deleteFile, deleteFiles } from '../lib/s3-client.js';

const router: ReturnType<typeof Router> = Router();

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const MAX_PER_TRANSFER = 5;
const MAX_ATTACHMENTS_ERROR = 'MAX_TRANSFER_ATTACHMENTS';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not allowed') as unknown as null, false);
  },
});

router.post('/devices/:deviceId/transfer/attachments', upload.array('files', MAX_PER_TRANSFER), async (req: Request, res: Response) => {
  const uploadedKeys: string[] = [];
  try {
    const device = await prisma.device.findUnique({ where: { id: req.params.deviceId as string } });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const files = req.files as Express.Multer.File[];
    if (!files?.length) return res.status(400).json({ error: 'No files provided' });
    if (files.length > MAX_PER_TRANSFER) return res.status(400).json({ error: `Maximum ${MAX_PER_TRANSFER} attachments per transfer` });

    const preparedFiles = files.map((file) => {
      const attachmentId = uuidv4();
      const ext = path.extname(file.originalname) || '.bin';
      return {
        file,
        attachmentId,
        key: `transfers/${req.params.deviceId}/${attachmentId}${ext}`,
      };
    });

    for (const preparedFile of preparedFiles) {
      await uploadFile(preparedFile.key, preparedFile.file.buffer, preparedFile.file.mimetype);
      uploadedKeys.push(preparedFile.key);
    }

    const created = await prisma.$transaction(async (tx) => {
      const transferRecord = await ensureTransferRecordForDevice(req.params.deviceId as string, tx);
      if (!transferRecord) throw new Error('TRANSFER_RECORD_NOT_FOUND');

      const existingCount = await tx.transferAttachment.count({ where: { transferId: transferRecord.id } });
      if (existingCount + preparedFiles.length > MAX_PER_TRANSFER) {
        throw new Error(MAX_ATTACHMENTS_ERROR);
      }

      return Promise.all(preparedFiles.map((preparedFile) => tx.transferAttachment.create({
        data: {
          id: preparedFile.attachmentId,
          transferId: transferRecord.id,
          fileKey: preparedFile.key,
          fileName: preparedFile.file.originalname,
          fileType: preparedFile.file.mimetype,
          fileSize: preparedFile.file.size,
        },
      })));
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    res.status(201).json(created.map((attachment) => ({
      id: attachment.id,
      file_name: attachment.fileName,
      file_type: attachment.fileType,
      file_size: attachment.fileSize,
      created_at: attachment.createdAt.toISOString(),
    })));
  } catch (err) {
    if (uploadedKeys.length > 0) {
      try { await deleteFiles(uploadedKeys); } catch (cleanupErr: unknown) { console.warn('Transfer attachment cleanup warning:', (cleanupErr as Error).message); }
    }
    if (err instanceof Error && err.message === MAX_ATTACHMENTS_ERROR) {
      return res.status(400).json({ error: `Maximum ${MAX_PER_TRANSFER} attachments per transfer` });
    }
    if ((err as { code?: string }).code === 'P2034') {
      return res.status(409).json({ error: 'Có thay đổi đồng thời, vui lòng thử lại' });
    }
    console.error('Upload transfer attachments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/transfer-attachments/:id/file', async (req: Request, res: Response) => {
  try {
    const attachment = await prisma.transferAttachment.findUnique({ where: { id: req.params.id as string } });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

    const { stream, contentType } = await downloadFile(attachment.fileKey);
    res.set('Content-Type', attachment.fileType || contentType);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', `inline; filename="${attachment.fileName}"`);
    stream.pipe(res);
  } catch (err) {
    console.error('Download transfer attachment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/transfer-attachments/:id', async (req: Request, res: Response) => {
  try {
    const attachment = await prisma.transferAttachment.findUnique({ where: { id: req.params.id as string } });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

    await prisma.transferAttachment.delete({ where: { id: req.params.id as string } });
    try { await deleteFile(attachment.fileKey); } catch (e: unknown) { console.warn('S3 delete warning:', (e as Error).message); }
    await cleanupTransferRecordIfEmpty(attachment.transferId);

    res.status(204).send();
  } catch (err) {
    console.error('Delete transfer attachment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
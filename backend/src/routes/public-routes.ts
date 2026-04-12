import { Router, type Request, type Response } from 'express';
import prisma from '../lib/prisma-client.js';

const router: ReturnType<typeof Router> = Router();

// GET /api/public/device/:id — public device info (full details + attachments + maintenance)
router.get('/device/:id', async (req: Request, res: Response) => {
  try {
    const device = await prisma.device.findUnique({
      where: { id: req.params.id as string },
      include: {
        location: { select: { name: true } },
        attachments: {
          select: { id: true, fileName: true, fileType: true, fileSize: true, isPrimary: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        transferRecord: {
          include: {
            attachments: {
              select: { id: true, fileName: true, fileType: true, fileSize: true, createdAt: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        maintenanceRecords: {
          include: {
            attachments: { select: { id: true, fileName: true, fileType: true, fileSize: true, createdAt: true } },
          },
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!device) return res.status(404).json({ error: 'Device not found' });

    const result = {
      id: device.id,
      store_id: device.storeId,
      name: device.name,
      type: device.type,
      status: device.status,
      location_name: device.location?.name || null,
      owned_by: device.ownedBy,
      serial_number: device.serialNumber,
      model: device.model,
      manufacturer: device.manufacturer,
      description: device.description,
      created_at: device.createdAt.toISOString(),
      transfer_to: device.transferTo || null,
      transfer_date: device.transferDate?.toISOString() || null,
      transfer_record: device.transferRecord ? {
        id: device.transferRecord.id,
        owned_by: device.transferRecord.ownedBy || null,
        transfer_to: device.transferRecord.transferTo || null,
        transfer_date: device.transferRecord.transferDate?.toISOString() || null,
        attachments: device.transferRecord.attachments.map(a => ({
          id: a.id,
          file_name: a.fileName,
          file_type: a.fileType,
          file_size: a.fileSize,
          created_at: a.createdAt.toISOString(),
        })),
      } : (device.ownedBy || device.transferTo || device.transferDate) ? {
        id: null,
        owned_by: device.ownedBy || null,
        transfer_to: device.transferTo || null,
        transfer_date: device.transferDate?.toISOString() || null,
        attachments: [],
      } : null,
      attachments: device.attachments.map(a => ({
        id: a.id,
        device_id: device.id,
        file_name: a.fileName,
        file_type: a.fileType,
        file_size: a.fileSize,
        is_primary: a.isPrimary,
        created_at: a.createdAt.toISOString(),
      })),
      maintenance_records: device.type === 'tai_san' ? device.maintenanceRecords.map(r => ({
        id: r.id,
        date: r.date.toISOString(),
        description: r.description,
        technician: r.technician,
        status: r.status,
        attachments: r.attachments.map(a => ({
          id: a.id,
          file_name: a.fileName,
          file_type: a.fileType,
          file_size: a.fileSize,
          created_at: a.createdAt.toISOString(),
        })),
      })) : undefined,
    };

    res.json(result);
  } catch (err: unknown) {
    console.error('Public device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

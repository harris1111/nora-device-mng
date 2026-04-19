import { Router, type Request, type Response } from 'express';
import ExcelJS from 'exceljs';
import prisma from '../lib/prisma-client.js';
import { requirePermission } from '../middleware/require-permission.js';

const router: ReturnType<typeof Router> = Router();

const TYPE_LABELS: Record<string, string> = {
  tai_san: 'Tài sản',
  cong_cu_dung_cu: 'Công cụ dụng cụ',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Đang sử dụng',
  under_repair: 'Đang sửa chữa',
  decommissioned: 'Đã thanh lý',
  disposed: 'Đã xử lý',
  lost: 'Đã mất',
};

// Helper: get location-based where clause for USER role
async function getUserLocationFilter(req: Request): Promise<Record<string, unknown> | null> {
  if (req.user!.role !== 'USER') return null;
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

// POST /api/devices/export/excel — export selected devices to Excel
router.post('/excel', requirePermission('devices', 'view'), async (req: Request, res: Response) => {
  try {
    const { device_ids } = req.body as { device_ids?: string[] };
    if (!Array.isArray(device_ids) || device_ids.length === 0) {
      res.status(400).json({ error: 'device_ids array is required' });
      return;
    }
    if (device_ids.length > 500) {
      res.status(400).json({ error: 'Cannot export more than 500 devices at once' });
      return;
    }

    // Build where clause with RBAC filtering
    const where: Record<string, unknown> = { id: { in: device_ids } };
    const locationFilter = await getUserLocationFilter(req);
    if (locationFilter) {
      where.AND = [locationFilter];
    }

    const devices = await prisma.device.findMany({
      where,
      include: { location: true },
      orderBy: { createdAt: 'desc' },
    });

    const baseUrl = process.env.BASE_URL || 'http://localhost:13000';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BWPDevices';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Danh sách thiết bị');

    // Define columns
    sheet.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'Mã thiết bị', key: 'store_id', width: 18 },
      { header: 'Tên thiết bị', key: 'name', width: 30 },
      { header: 'Loại thiết bị', key: 'type', width: 18 },
      { header: 'Trạng thái', key: 'status', width: 18 },
      { header: 'Đơn vị trực thuộc', key: 'location', width: 22 },
      { header: 'Đơn vị chuyển giao', key: 'transfer_to', width: 22 },
      { header: 'Ngày nhập', key: 'created_at', width: 14 },
      { header: 'Mã QRCode', key: 'qrcode', width: 35 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 28;

    // Add data rows
    devices.forEach((device, index) => {
      const row = sheet.addRow({
        stt: index + 1,
        store_id: device.storeId,
        name: device.name,
        type: TYPE_LABELS[device.type] || device.type,
        status: STATUS_LABELS[device.status] || device.status,
        location: device.location?.name || '',
        transfer_to: device.transferTo || '',
        created_at: device.createdAt.toLocaleDateString('vi-VN'),
        qrcode: `${baseUrl}/public/device/${device.id}`,
      });

      row.alignment = { vertical: 'middle', wrapText: true };
      row.height = 22;

      // Alternating row colors
      if (index % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        });
      }
    });

    // Add borders to all cells
    const lastRow = sheet.rowCount;
    for (let r = 1; r <= lastRow; r++) {
      const row = sheet.getRow(r);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
    }

    // Auto-filter
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 9 },
    };

    // Freeze header row
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `thiet-bi-${timestamp}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import { Router, type Request, type Response } from 'express';
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../lib/prisma-client.js';
import { requirePermission } from '../middleware/require-permission.js';
import { generateQrCode } from '../utils/qrcode-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
router.post('/excel', requirePermission('devices', 'export'), async (req: Request, res: Response) => {
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

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BWPDevices';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Danh sách thiết bị');

    // Define columns (no header text — we'll add the table header manually)
    sheet.columns = [
      { key: 'stt', width: 6 },
      { key: 'store_id', width: 18 },
      { key: 'name', width: 30 },
      { key: 'type', width: 18 },
      { key: 'status', width: 18 },
      { key: 'location', width: 22 },
      { key: 'transfer_to', width: 22 },
      { key: 'created_at', width: 14 },
      { key: 'qrcode', width: 18 },
    ];

    // ── Branded header area (rows 1–5) ──────────────────────────
    const HEADER_ROWS = 5; // rows reserved for logo + title
    const DATA_HEADER_ROW = HEADER_ROWS + 1; // row 6 = table column headers

    // Insert logo image in top-left corner
    const logoPath = path.resolve(__dirname, '../../image/image.png');
    if (fs.existsSync(logoPath)) {
      const logoId = workbook.addImage({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        buffer: fs.readFileSync(logoPath) as any,
        extension: 'png',
      });
      // Logo spans A1:B5 (cols 0–2, rows 0–5)
      sheet.addImage(logoId, {
        tl: { col: 0, row: 0 } as unknown as ExcelJS.Anchor,
        br: { col: 2, row: HEADER_ROWS } as unknown as ExcelJS.Anchor,
      });
    }

    // Title "Danh sách thiết bị" merged across C2:I3
    sheet.mergeCells('C2:I3');
    const titleCell = sheet.getCell('C2');
    titleCell.value = 'Danh sách thiết bị';
    titleCell.font = { bold: true, size: 18 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Set header area row heights
    for (let r = 1; r <= HEADER_ROWS; r++) {
      sheet.getRow(r).height = 22;
    }

    // ── Table column header (row 6) ─────────────────────────────
    const colHeaders = [
      'STT', 'Mã thiết bị', 'Tên thiết bị', 'Loại thiết bị', 'Trạng thái',
      'Đơn vị trực thuộc', 'Đơn vị chuyển giao', 'Ngày nhập', 'Mã QRCode',
    ];
    const headerRow = sheet.getRow(DATA_HEADER_ROW);
    colHeaders.forEach((text, i) => {
      headerRow.getCell(i + 1).value = text;
    });
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 28;

    // Generate QR code images in parallel
    const qrBuffers = await Promise.all(
      devices.map(device => generateQrCode(device.id))
    );

    // QR image size in pixels and row height
    const qrSize = 110;
    const qrRowHeight = 90;

    // Add data rows with embedded QR images
    devices.forEach((device, index) => {
      const rowNumber = DATA_HEADER_ROW + 1 + index; // first data row = 7
      const row = sheet.getRow(rowNumber);
      row.values = [
        index + 1,
        device.storeId,
        device.name,
        TYPE_LABELS[device.type] || device.type,
        STATUS_LABELS[device.status] || device.status,
        device.location?.name || '',
        device.ownedBy ? [device.location?.name, device.ownedBy].filter(Boolean).join(' → ') : '',
        device.createdAt.toLocaleDateString('vi-VN'),
        '',
      ];

      row.alignment = { vertical: 'middle', wrapText: true };
      row.height = qrRowHeight;

      // Embed QR code image in column I (index 8, 0-based)
      const imageId = workbook.addImage({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        buffer: qrBuffers[index] as any,
        extension: 'png',
      });
      sheet.addImage(imageId, {
        tl: { col: 8, row: rowNumber - 1 },
        ext: { width: qrSize, height: qrSize },
      });

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

    // Auto-filter on table header row
    sheet.autoFilter = {
      from: { row: DATA_HEADER_ROW, column: 1 },
      to: { row: DATA_HEADER_ROW, column: 9 },
    };

    // Freeze rows above data (header area + table column header)
    sheet.views = [{ state: 'frozen', ySplit: DATA_HEADER_ROW }];

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

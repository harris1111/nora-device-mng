import { Router, type Request, type Response } from 'express';
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../lib/prisma-client.js';
import { requirePermission } from '../middleware/require-permission.js';
import { generateQrCode } from '../utils/qrcode-generator.js';
import { buildDeviceListWhere } from './device-routes.js';

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

type DeviceWithLocation = Awaited<ReturnType<typeof prisma.device.findMany>>[number] & {
  location?: { name: string } | null;
};

// Build a styled, QR-embedded XLSX workbook for the given devices
async function buildDevicesWorkbook(devices: DeviceWithLocation[]): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BWPDevices';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Danh sách thiết bị');

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
  const HEADER_ROWS = 5;
  const DATA_HEADER_ROW = HEADER_ROWS + 1;

  const logoPath = path.resolve(__dirname, '../../image/image.png');
  if (fs.existsSync(logoPath)) {
    const logoId = workbook.addImage({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      buffer: fs.readFileSync(logoPath) as any,
      extension: 'png',
    });
    sheet.addImage(logoId, {
      tl: { col: 0, row: 0 } as unknown as ExcelJS.Anchor,
      br: { col: 2, row: HEADER_ROWS } as unknown as ExcelJS.Anchor,
    });
  }

  sheet.mergeCells('C2:I3');
  const titleCell = sheet.getCell('C2');
  titleCell.value = 'Danh sách thiết bị';
  titleCell.font = { bold: true, size: 18 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  for (let r = 1; r <= HEADER_ROWS; r++) sheet.getRow(r).height = 22;

  const colHeaders = [
    'STT', 'Mã thiết bị', 'Tên thiết bị', 'Loại thiết bị', 'Trạng thái',
    'Đơn vị trực thuộc', 'Đơn vị chuyển giao', 'Ngày nhập', 'Mã QRCode',
  ];
  const headerRow = sheet.getRow(DATA_HEADER_ROW);
  colHeaders.forEach((text, i) => { headerRow.getCell(i + 1).value = text; });
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 28;

  const qrBuffers = await Promise.all(devices.map(d => generateQrCode(d.id)));
  const qrSize = 110;
  const qrRowHeight = 90;

  devices.forEach((device, index) => {
    const rowNumber = DATA_HEADER_ROW + 1 + index;
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

    const imageId = workbook.addImage({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      buffer: qrBuffers[index] as any,
      extension: 'png',
    });
    sheet.addImage(imageId, {
      tl: { col: 8, row: rowNumber - 1 },
      ext: { width: qrSize, height: qrSize },
    });

    if (index % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });

  const lastRow = sheet.rowCount;
  for (let r = 1; r <= lastRow; r++) {
    sheet.getRow(r).eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  }

  sheet.autoFilter = {
    from: { row: DATA_HEADER_ROW, column: 1 },
    to: { row: DATA_HEADER_ROW, column: 9 },
  };
  sheet.views = [{ state: 'frozen', ySplit: DATA_HEADER_ROW }];

  return workbook;
}

async function sendWorkbook(res: Response, workbook: ExcelJS.Workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `thiet-bi-${timestamp}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buffer));
}

// POST /api/devices/export/excel — export specific devices by ID (used by /export page)
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

    const where: Record<string, unknown> = { id: { in: device_ids } };
    const locationFilter = await getUserLocationFilter(req);
    if (locationFilter) where.AND = [locationFilter];

    const devices = await prisma.device.findMany({
      where,
      include: { location: true },
      orderBy: { createdAt: 'desc' },
    });

    const workbook = await buildDevicesWorkbook(devices as DeviceWithLocation[]);
    await sendWorkbook(res, workbook);
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/devices/export/excel — export devices matching the same filters as the list page
router.get('/excel', requirePermission('devices', 'export'), async (req: Request, res: Response) => {
  try {
    const where = await buildDeviceListWhere(req);

    const devices = await prisma.device.findMany({
      where,
      include: { location: true },
      orderBy: { createdAt: 'desc' },
    });

    if (devices.length === 0) {
      res.status(400).json({ error: 'No devices match the current filters' });
      return;
    }

    const workbook = await buildDevicesWorkbook(devices as DeviceWithLocation[]);
    await sendWorkbook(res, workbook);
  } catch (err) {
    console.error('Excel filtered export error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

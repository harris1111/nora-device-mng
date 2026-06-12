import { Router, type Request, type Response } from 'express';
import prisma from '../lib/prisma-client.js';
import { requirePermission } from '../middleware/require-permission.js';
import {
  DEVICE_EXCEL_EXPORT_TYPES,
  getDeviceExcelColumnOptions,
  parseDeviceExcelColumnKeys,
  resolveDeviceExcelColumns,
  resolveDeviceExcelExportType,
  type DeviceExcelExportRecord,
} from '../utils/device-excel-export-config.js';
import { buildDevicesWorkbook } from '../utils/device-excel-workbook-builder.js';
import { buildDeviceListWhere } from './device-routes.js';

const router: ReturnType<typeof Router> = Router();

interface ExcelRequestOptions {
  columns: ReturnType<typeof resolveDeviceExcelColumns>;
  filenamePrefix: string;
  title: string;
}

function isExportRequestError(error: unknown): error is Error {
  return error instanceof Error && (
    error.message.startsWith('Unsupported export_type')
    || error.message.startsWith('Unsupported columns')
    || error.message === 'At least one column is required'
  );
}

function readRequestValue(req: Request, key: string): unknown {
  if (req.method === 'GET') return req.query[key];
  return (req.body as Record<string, unknown> | undefined)?.[key];
}

function getExcelRequestOptions(req: Request): ExcelRequestOptions {
  const exportType = resolveDeviceExcelExportType(readRequestValue(req, 'export_type'));
  const typeOption = DEVICE_EXCEL_EXPORT_TYPES.find((item) => item.key === exportType)!;
  const columns = resolveDeviceExcelColumns(parseDeviceExcelColumnKeys(readRequestValue(req, 'columns')));

  return {
    columns,
    filenamePrefix: exportType === 'devices' ? 'thiet-bi' : exportType,
    title: typeOption.label,
  };
}

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

async function sendWorkbook(res: Response, workbook: Awaited<ReturnType<typeof buildDevicesWorkbook>>, filenamePrefix: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `${filenamePrefix}-${timestamp}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buffer));
}

router.get('/options', requirePermission('devices', 'export'), (_req: Request, res: Response) => {
  res.json({
    export_types: DEVICE_EXCEL_EXPORT_TYPES,
    columns: {
      devices: getDeviceExcelColumnOptions(),
    },
  });
});

// POST /api/devices/export/excel — export specific devices by ID (used by /export page)
router.post('/excel', requirePermission('devices', 'export'), async (req: Request, res: Response) => {
  try {
    const options = getExcelRequestOptions(req);
    const { device_ids } = req.body as { device_ids?: string[] };
    if (!Array.isArray(device_ids) || device_ids.length === 0) {
      res.status(400).json({ error: 'device_ids array is required' });
      return;
    }
    if (device_ids.length > 500) {
      res.status(400).json({ error: 'Cannot export more than 500 devices at once' });
      return;
    }

    const where: Record<string, unknown> = { id: { in: device_ids }, roomId: null };
    const locationFilter = await getUserLocationFilter(req);
    if (locationFilter) where.AND = [locationFilter];

    const devices = await prisma.device.findMany({
      where,
      include: { location: true, area: true },
      orderBy: { createdAt: 'desc' },
    });

    if (devices.length === 0) {
      res.status(400).json({ error: 'No devices are available for export' });
      return;
    }

    const workbook = await buildDevicesWorkbook({
      devices: devices as DeviceExcelExportRecord[],
      columns: options.columns,
      title: options.title,
    });
    await sendWorkbook(res, workbook, options.filenamePrefix);
  } catch (err) {
    if (isExportRequestError(err)) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('Excel export error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/devices/export/excel — export devices matching the same filters as the list page
router.get('/excel', requirePermission('devices', 'export'), async (req: Request, res: Response) => {
  try {
    const options = getExcelRequestOptions(req);
    const where = await buildDeviceListWhere(req);

    const devices = await prisma.device.findMany({
      where,
      include: { location: true, area: true },
      orderBy: { createdAt: 'desc' },
    });

    if (devices.length === 0) {
      res.status(400).json({ error: 'No devices match the current filters' });
      return;
    }

    const workbook = await buildDevicesWorkbook({
      devices: devices as DeviceExcelExportRecord[],
      columns: options.columns,
      title: options.title,
    });
    await sendWorkbook(res, workbook, options.filenamePrefix);
  } catch (err) {
    if (isExportRequestError(err)) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('Excel filtered export error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

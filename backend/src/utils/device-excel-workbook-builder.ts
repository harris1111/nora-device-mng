import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEffectiveBaseUrl } from '../lib/settings.js';
import { generateQrCode } from './qrcode-generator.js';
import type { DeviceExcelExportColumn, DeviceExcelExportRecord } from './device-excel-export-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HEADER_ROWS = 5;
const DATA_HEADER_ROW = HEADER_ROWS + 1;
const HEADER_FILL = 'FF2563EB';
const STRIPE_FILL = 'FFF8FAFC';
const BORDER_COLOR = 'FFE2E8F0';
type ExcelImageBuffer = NonNullable<ExcelJS.Image['buffer']>;

interface BuildDeviceWorkbookInput {
  devices: DeviceExcelExportRecord[];
  columns: DeviceExcelExportColumn[];
  title: string;
}

function toExcelImageBuffer(buffer: Buffer): ExcelImageBuffer {
  return buffer as unknown as ExcelImageBuffer;
}

function addWorkbookLogo(workbook: ExcelJS.Workbook, sheet: ExcelJS.Worksheet, columnCount: number): void {
  const logoPath = path.resolve(__dirname, '../../image/image.png');
  if (columnCount < 2 || !fs.existsSync(logoPath)) return;

  const logoId = workbook.addImage({
    buffer: toExcelImageBuffer(fs.readFileSync(logoPath)),
    extension: 'png',
  });
  sheet.addImage(logoId, {
    tl: { col: 0, row: 0 } as unknown as ExcelJS.Anchor,
    br: { col: 2, row: HEADER_ROWS } as unknown as ExcelJS.Anchor,
  });
}

function styleHeader(sheet: ExcelJS.Worksheet, title: string, columnCount: number): void {
  for (let rowNumber = 1; rowNumber <= HEADER_ROWS; rowNumber += 1) {
    sheet.getRow(rowNumber).height = 22;
  }

  const titleStartColumn = columnCount >= 3 ? 3 : 1;
  sheet.mergeCells(2, titleStartColumn, 3, columnCount);
  const titleCell = sheet.getCell(2, titleStartColumn);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 18 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
}

function styleDataHeader(sheet: ExcelJS.Worksheet, columns: DeviceExcelExportColumn[]): void {
  const headerRow = sheet.getRow(DATA_HEADER_ROW);
  columns.forEach((column, index) => {
    headerRow.getCell(index + 1).value = column.label;
  });
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  headerRow.height = 30;
}

function applyTableBorders(sheet: ExcelJS.Worksheet): void {
  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    sheet.getRow(rowNumber).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: BORDER_COLOR } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } },
      };
    });
  }
}

export async function buildDevicesWorkbook({ devices, columns, title }: BuildDeviceWorkbookInput): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BWPDevices';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(title);
  sheet.columns = columns.map((column) => ({ key: column.key, width: column.width }));

  addWorkbookLogo(workbook, sheet, columns.length);
  styleHeader(sheet, title, columns.length);
  styleDataHeader(sheet, columns);

  const qrColumnIndex = columns.findIndex((column) => column.requiresQr);
  const baseUrl = qrColumnIndex >= 0 ? await getEffectiveBaseUrl() : '';
  const qrBuffers = qrColumnIndex >= 0
    ? await Promise.all(devices.map((device) => generateQrCode(device.id, baseUrl)))
    : [];

  devices.forEach((device, index) => {
    const rowNumber = DATA_HEADER_ROW + 1 + index;
    const row = sheet.getRow(rowNumber);
    row.values = columns.map((column) => column.getValue(device, index));
    row.alignment = { vertical: 'middle', wrapText: true };
    row.height = qrColumnIndex >= 0 ? 90 : 26;

    if (index % 2 === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE_FILL } };
      });
    }

    if (qrColumnIndex >= 0) {
      const imageId = workbook.addImage({ buffer: toExcelImageBuffer(qrBuffers[index]), extension: 'png' });
      sheet.addImage(imageId, {
        tl: { col: qrColumnIndex, row: rowNumber - 1 },
        ext: { width: 110, height: 110 },
      });
    }
  });

  applyTableBorders(sheet);
  sheet.autoFilter = {
    from: { row: DATA_HEADER_ROW, column: 1 },
    to: { row: DATA_HEADER_ROW, column: columns.length },
  };
  sheet.views = [{ state: 'frozen', ySplit: DATA_HEADER_ROW }];

  return workbook;
}

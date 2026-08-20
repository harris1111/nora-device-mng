export type DeviceExcelExportType = 'devices';

export type DeviceExcelExportColumnKey =
  | 'stt'
  | 'store_id'
  | 'name'
  | 'type'
  | 'status'
  | 'location'
  | 'area'
  | 'owned_by'
  | 'transfer_to'
  | 'serial_number'
  | 'manufacturer'
  | 'model'
  | 'warranty_period'
  | 'maintenance_status'
  | 'inventory_status'
  | 'created_at'
  | 'qrcode'
  | 'system_category';

export interface DeviceExcelExportRecord {
  id: string;
  storeId: string;
  name: string;
  type: string;
  status: string;
  location?: { name: string } | null;
  area?: { name: string } | null;
  ownedBy: string;
  transferTo: string | null;
  serialNumber: string;
  manufacturer: string;
  model: string;
  warrantyPeriod: string | null;
  maintenanceStatus: string;
  inventoryStatus: string;
  systemCategory?: string | null;
  createdAt: Date;
}

export interface DeviceExcelExportColumn {
  key: DeviceExcelExportColumnKey;
  label: string;
  width: number;
  requiresQr?: boolean;
  getValue: (device: DeviceExcelExportRecord, index: number) => string | number;
}

export interface DeviceExcelExportColumnOption {
  key: DeviceExcelExportColumnKey;
  label: string;
  default: boolean;
}

export interface DeviceExcelExportTypeOption {
  key: DeviceExcelExportType;
  label: string;
}

const TYPE_LABELS: Record<string, string> = {
  tai_san: 'Tài sản',
  cong_cu_dung_cu: 'Công cụ dụng cụ',
  system: 'Hệ thống',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Đang sử dụng',
  under_repair: 'Đang sửa chữa',
  needs_inventory: 'Cần kiểm kê',
  decommissioned: 'Đã thanh lý',
  disposed: 'Đã xử lý',
  lost: 'Đã mất',
};

const MAINTENANCE_STATUS_LABELS: Record<string, string> = {
  in_use: 'Bình thường',
  needs_maintenance: 'Cần bảo trì',
};

const INVENTORY_STATUS_LABELS: Record<string, string> = {
  in_use: 'Bình thường',
  needs_inventory: 'Cần kiểm kê',
};

export const DEVICE_EXCEL_EXPORT_TYPES: DeviceExcelExportTypeOption[] = [
  { key: 'devices', label: 'Danh sách thiết bị' },
];

export const DEFAULT_DEVICE_EXCEL_COLUMNS: DeviceExcelExportColumnKey[] = [
  'stt',
  'store_id',
  'name',
  'type',
  'status',
  'location',
  'area',
  'transfer_to',
  'created_at',
  'qrcode',
];

export const DEVICE_EXCEL_COLUMNS: DeviceExcelExportColumn[] = [
  { key: 'stt', label: 'STT', width: 6, getValue: (_device, index) => index + 1 },
  { key: 'store_id', label: 'Mã thiết bị', width: 18, getValue: (device) => device.storeId },
  { key: 'name', label: 'Tên thiết bị', width: 30, getValue: (device) => device.name },
  { key: 'type', label: 'Loại thiết bị', width: 22, getValue: (device) => device.type === 'system' ? (device.systemCategory ? `Hệ thống (${device.systemCategory})` : 'Hệ thống') : (TYPE_LABELS[device.type] || device.type) },
  { key: 'system_category', label: 'Loại hệ thống', width: 24, getValue: (device) => device.systemCategory || '' },
  { key: 'status', label: 'Trạng thái', width: 18, getValue: (device) => STATUS_LABELS[device.status] || device.status },
  { key: 'location', label: 'Đơn vị trực thuộc', width: 24, getValue: (device) => device.location?.name || '' },
  { key: 'area', label: 'Khu vực', width: 18, getValue: (device) => device.area?.name || '' },
  { key: 'owned_by', label: 'Đơn vị đang giữ', width: 24, getValue: (device) => device.ownedBy || '' },
  {
    key: 'transfer_to',
    label: 'Đơn vị chuyển giao',
    width: 26,
    getValue: (device) => device.transferTo || (device.ownedBy ? [device.location?.name, device.ownedBy].filter(Boolean).join(' → ') : ''),
  },
  { key: 'serial_number', label: 'Serial', width: 20, getValue: (device) => device.serialNumber || '' },
  { key: 'manufacturer', label: 'Nhà sản xuất', width: 20, getValue: (device) => device.manufacturer || '' },
  { key: 'model', label: 'Model', width: 20, getValue: (device) => device.model || '' },
  { key: 'warranty_period', label: 'Thời hạn bảo hành', width: 20, getValue: (device) => device.warrantyPeriod || '' },
  {
    key: 'maintenance_status',
    label: 'Tình trạng bảo trì',
    width: 22,
    getValue: (device) => MAINTENANCE_STATUS_LABELS[device.maintenanceStatus] || device.maintenanceStatus,
  },
  {
    key: 'inventory_status',
    label: 'Tình trạng kiểm kê',
    width: 22,
    getValue: (device) => INVENTORY_STATUS_LABELS[device.inventoryStatus] || device.inventoryStatus,
  },
  { key: 'created_at', label: 'Ngày nhập', width: 14, getValue: (device) => device.createdAt.toLocaleDateString('vi-VN') },
  { key: 'qrcode', label: 'Mã QRCode', width: 18, requiresQr: true, getValue: () => '' },
];

const DEVICE_COLUMN_BY_KEY = new Map(DEVICE_EXCEL_COLUMNS.map((column) => [column.key, column]));

export function resolveDeviceExcelExportType(rawType: unknown): DeviceExcelExportType {
  const type = typeof rawType === 'string' && rawType.trim() ? rawType.trim() : 'devices';
  if (type !== 'devices') throw new Error(`Unsupported export_type: ${type}`);
  return type;
}

export function parseDeviceExcelColumnKeys(rawColumns: unknown): string[] | undefined {
  if (rawColumns === undefined || rawColumns === null || rawColumns === '') return undefined;
  if (Array.isArray(rawColumns)) return rawColumns.flatMap((value) => String(value).split(','));
  if (typeof rawColumns === 'string') return rawColumns.split(',');
  return [String(rawColumns)];
}

export function resolveDeviceExcelColumns(rawKeys?: string[]): DeviceExcelExportColumn[] {
  const keys = rawKeys?.map((key) => key.trim()).filter(Boolean) || DEFAULT_DEVICE_EXCEL_COLUMNS;
  const uniqueKeys = Array.from(new Set(keys));
  const invalidKeys = uniqueKeys.filter((key) => !DEVICE_COLUMN_BY_KEY.has(key as DeviceExcelExportColumnKey));
  if (invalidKeys.length > 0) throw new Error(`Unsupported columns: ${invalidKeys.join(', ')}`);
  if (uniqueKeys.length === 0) throw new Error('At least one column is required');

  return uniqueKeys.map((key) => DEVICE_COLUMN_BY_KEY.get(key as DeviceExcelExportColumnKey)!);
}

export function getDeviceExcelColumnOptions(): DeviceExcelExportColumnOption[] {
  const defaults = new Set(DEFAULT_DEVICE_EXCEL_COLUMNS);
  return DEVICE_EXCEL_COLUMNS.map((column) => ({
    key: column.key,
    label: column.label,
    default: defaults.has(column.key),
  }));
}

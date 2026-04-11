export const DEVICE_TYPES: string[] = ['tai_san', 'cong_cu_dung_cu'];

export const STATUS_BY_TYPE: Record<string, string[]> = {
  tai_san: ['active', 'under_repair', 'decommissioned'],
  cong_cu_dung_cu: ['active', 'disposed', 'lost'],
};

export const TYPE_LABELS: Record<string, string> = {
  tai_san: 'Tài sản',
  cong_cu_dung_cu: 'Công cụ dụng cụ',
};

export const STATUS_LABELS: Record<string, string> = {
  active: 'Đang sử dụng',
  under_repair: 'Đang sửa chữa',
  decommissioned: 'Đã thanh lý',
  disposed: 'Đã xử lý',
  lost: 'Đã mất',
};

export function validateTypeStatus(type: string, status: string): string | null {
  if (!DEVICE_TYPES.includes(type)) return `Invalid type: ${type}`;
  if (!STATUS_BY_TYPE[type].includes(status)) return `Invalid status "${status}" for type "${type}"`;
  return null;
}

export interface StatusData {
  type: string;
  status: string;
  disposalDate: Date | null;
  lossDate: Date | null;
}

export function applyDateStatusRules(type: string, data: StatusData): StatusData {
  if (type !== 'cong_cu_dung_cu') {
    data.disposalDate = null;
    data.lossDate = null;
    return data;
  }
  if (data.disposalDate) data.status = 'disposed';
  if (data.lossDate) data.status = 'lost';
  return data;
}

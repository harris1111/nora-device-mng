interface StatusOption {
  value: string;
  label: string;
  color: string;
}

interface StatusInfo {
  label: string;
  color: string;
}

export const DEVICE_TYPES = [
  { value: 'tai_san', label: 'Tài sản' },
  { value: 'cong_cu_dung_cu', label: 'Công cụ dụng cụ' },
];

export const STATUS_BY_TYPE: Record<string, StatusOption[]> = {
  tai_san: [
    { value: 'active', label: 'Đang sử dụng', color: 'emerald' },
    { value: 'under_repair', label: 'Đang sửa chữa', color: 'amber' },
    { value: 'decommissioned', label: 'Đã thanh lý', color: 'slate' },
  ],
  cong_cu_dung_cu: [
    { value: 'active', label: 'Đang sử dụng', color: 'emerald' },
    { value: 'disposed', label: 'Đã xử lý', color: 'slate' },
    { value: 'lost', label: 'Đã mất', color: 'red' },
  ],
};

export const ALL_STATUSES: Record<string, StatusInfo> = {
  active: { label: 'Đang sử dụng', color: 'emerald' },
  under_repair: { label: 'Đang sửa chữa', color: 'amber' },
  decommissioned: { label: 'Đã thanh lý', color: 'slate' },
  disposed: { label: 'Đã xử lý', color: 'slate' },
  lost: { label: 'Đã mất', color: 'red' },
};

export const TYPE_LABELS: Record<string, string> = {
  tai_san: 'Tài sản',
  cong_cu_dung_cu: 'Công cụ dụng cụ',
};

export function getStatusInfo(status: string): StatusInfo {
  return ALL_STATUSES[status] || { label: status, color: 'slate' };
}

export function getTypeName(type: string): string {
  return TYPE_LABELS[type] || type;
}

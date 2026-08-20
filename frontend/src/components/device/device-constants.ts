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
  { value: 'system', label: 'Hệ thống' },
];

export const STATUS_BY_TYPE: Record<string, StatusOption[]> = {
  tai_san: [
    { value: 'active', label: 'Đang sử dụng', color: 'emerald' },
    { value: 'under_repair', label: 'Đang sửa chữa', color: 'amber' },
    { value: 'needs_inventory', label: 'Cần kiểm kê', color: 'sky' },
    { value: 'decommissioned', label: 'Đã thanh lý', color: 'slate' },
  ],
  cong_cu_dung_cu: [
    { value: 'active', label: 'Đang sử dụng', color: 'emerald' },
    { value: 'disposed', label: 'Đã xử lý', color: 'slate' },
    { value: 'lost', label: 'Đã mất', color: 'red' },
  ],
  system: [
    { value: 'active', label: 'Đang hoạt động', color: 'emerald' },
    { value: 'under_repair', label: 'Đang bảo trì', color: 'amber' },
    { value: 'decommissioned', label: 'Ngừng hoạt động', color: 'slate' },
  ],
};

export const ALL_STATUSES: Record<string, StatusInfo> = {
  active: { label: 'Đang sử dụng/hoạt động', color: 'emerald' },
  under_repair: { label: 'Đang sửa chữa/bảo trì', color: 'amber' },
  needs_inventory: { label: 'Cần kiểm kê', color: 'sky' },
  decommissioned: { label: 'Đã thanh lý/Ngừng hoạt động', color: 'slate' },
  disposed: { label: 'Đã xử lý', color: 'slate' },
  lost: { label: 'Đã mất', color: 'red' },
};

export const TYPE_LABELS: Record<string, string> = {
  tai_san: 'Tài sản',
  cong_cu_dung_cu: 'Công cụ dụng cụ',
  system: 'Hệ thống',
};

export function getStatusInfo(status: string): StatusInfo {
  return ALL_STATUSES[status] || { label: status, color: 'slate' };
}

export const SYSTEM_CATEGORIES = [
  { value: 'Hệ thống Bơm / Cấp thoát nước', label: 'Hệ thống Bơm / Cấp thoát nước' },
  { value: 'Hệ thống MEP / Kỹ thuật', label: 'Hệ thống MEP / Kỹ thuật' },
  { value: 'Hệ thống PCCC', label: 'Hệ thống PCCC' },
  { value: 'Hệ thống HVAC', label: 'Hệ thống HVAC' },
  { value: 'Hệ thống Điện', label: 'Hệ thống Điện' },
  { value: 'Phần mềm', label: 'Phần mềm' },
  { value: 'Phần cứng', label: 'Phần cứng' },
  { value: 'Mạng', label: 'Mạng' },
  { value: 'Khác', label: 'Khác' },
];

export function getTypeName(type: string): string {
  return TYPE_LABELS[type] || type;
}

export function getSystemCategoryLabel(category: string | null | undefined): string {
  if (!category) return 'Hệ thống';
  return SYSTEM_CATEGORIES.find(c => c.value === category)?.label || category;
}

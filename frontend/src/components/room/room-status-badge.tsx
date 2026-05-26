interface Props {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  in_use: { label: 'Đang sử dụng', color: 'bg-emerald-500' },
  maintenance: { label: 'Đang bảo trì', color: 'bg-amber-500' },
  repair: { label: 'Đang sửa chữa', color: 'bg-red-500' },
  needs_maintenance: { label: 'Cần bảo trì', color: 'bg-amber-500' },
};

export default function RoomStatusBadge({ status, size = 'sm' }: Props) {
  const info = STATUS_MAP[status] ?? { label: status, color: 'bg-slate-400' };
  const dotSize = size === 'sm' ? 'h-2 w-2' : 'h-3 w-3';

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span className={`inline-block rounded-full ${dotSize} ${info.color} flex-shrink-0`} />
      <span className="truncate">{info.label}</span>
    </span>
  );
}

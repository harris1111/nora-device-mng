import { getStatusInfo } from './device-constants';

const COLOR_MAP: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
  red: 'bg-red-50 text-red-700 border-red-200',
};

const DOT_MAP: Record<string, string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  slate: 'bg-slate-400',
  red: 'bg-red-500',
};

interface Props {
  status: string;
  className?: string;
}

export default function DeviceStatusBadge({ status, className = '' }: Props) {
  const info = getStatusInfo(status);
  const colors = COLOR_MAP[info.color] || COLOR_MAP.slate;
  const dot = DOT_MAP[info.color] || DOT_MAP.slate;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${colors} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span>
      {info.label}
    </span>
  );
}

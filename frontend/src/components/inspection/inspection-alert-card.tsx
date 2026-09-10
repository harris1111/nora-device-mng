import { useNavigate } from 'react-router-dom';
import type { Device } from '../../api/device-api';

interface Props {
  system: Device & {
    storeId?: string;
    room?: { name: string } | null;
    area?: { name: string } | null;
    location?: { name: string } | null;
  };
  onDismiss: (id: string) => void;
}

export default function InspectionAlertCard({ system, onDismiss }: Props) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    onDismiss(system.id);
    navigate(`/systems/${system.id}`);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss(system.id);
  };

  const locationLabel = [
    system.room?.name,
    system.area?.name || system.area_name,
    system.location?.name || system.location_name,
  ].filter(Boolean).join(' · ');

  const displayStoreId = system.storeId || system.store_id;

  return (
    <div
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      className="pointer-events-auto group relative w-full bg-white/95 backdrop-blur-md border-l-4 border-l-amber-500 border border-slate-200/80 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 p-4 cursor-pointer hover:-translate-y-0.5"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            CẦN KIỂM ĐỊNH
          </span>
          {displayStoreId && (
            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              {displayStoreId}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 -mr-1 -mt-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          title="Đóng thông báo này"
          aria-label="Đóng thông báo"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mt-2">
        <h4 className="text-sm font-bold text-slate-800 group-hover:text-amber-600 transition-colors line-clamp-1">
          {system.name}
        </h4>
        {locationLabel && (
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {locationLabel}
          </p>
        )}
        <p className="text-xs text-amber-600/90 font-medium mt-1 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Đến chu kỳ kiểm định định kỳ
        </p>
      </div>

      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-400 text-[11px]">Bấm để kiểm tra chi tiết</span>
        <span className="font-semibold text-amber-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
          Kiểm tra ngay &rarr;
        </span>
      </div>
    </div>
  );
}

import { useInspectionAlerts } from '../../context/inspection-alert-context';
import InspectionAlertCard from './inspection-alert-card';

const MAX_VISIBLE = 3;

export default function InspectionPopupStack() {
  const { alerts, dismissAlert, dismissAll } = useInspectionAlerts();

  if (!alerts || alerts.length === 0) return null;

  const visibleAlerts = alerts.slice(0, MAX_VISIBLE);
  const remainingCount = alerts.length - MAX_VISIBLE;

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 flex flex-col-reverse gap-2.5 w-[calc(100vw-2rem)] sm:w-96 pointer-events-none max-h-[calc(100vh-5rem)] overflow-y-auto pr-1">
      {/* Action bar if multiple items */}
      {alerts.length >= 2 && (
        <div className="pointer-events-auto flex items-center justify-between bg-slate-900/80 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-lg shadow-md">
          <span>{alerts.length} hệ thống cần kiểm định</span>
          <button
            type="button"
            onClick={dismissAll}
            className="text-amber-300 hover:text-amber-200 font-semibold underline"
          >
            Bỏ qua tất cả
          </button>
        </div>
      )}

      {/* Overflow indicator */}
      {remainingCount > 0 && (
        <div className="pointer-events-auto text-center text-xs font-semibold py-1 px-3 bg-amber-50/90 text-amber-800 border border-amber-200 rounded-lg shadow-sm">
          +{remainingCount} hệ thống khác đang chờ kiểm định
        </div>
      )}

      {/* Stacked cards */}
      {visibleAlerts.map(sys => (
        <InspectionAlertCard
          key={sys.id}
          system={sys}
          onDismiss={dismissAlert}
        />
      ))}
    </div>
  );
}

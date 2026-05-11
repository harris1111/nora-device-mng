import { useState, useEffect, useCallback } from 'react';
import {
  getMaintenanceSchedule,
  upsertMaintenanceSchedule,
  deleteMaintenanceSchedule,
  MaintenanceSchedule,
} from '../../api/device-api';
import VnDatePicker from '../ui/vn-date-picker';

interface Props {
  deviceId: string;
  /** Current maintenance status as reported by the device record (drives the chip color). */
  maintenanceStatus?: 'in_use' | 'needs_maintenance';
  /** Notify parent when something changed so it can refetch the device. */
  onChange?: () => void;
}

export default function MaintenanceSection({ deviceId, maintenanceStatus, onChange }: Props) {
  const [schedule, setSchedule] = useState<MaintenanceSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Schedule form state
  const [scheduleEditing, setScheduleEditing] = useState(false);
  const [intervalDays, setIntervalDays] = useState('180');
  const [notifyDaysBefore, setNotifyDaysBefore] = useState('7');
  const [lastMaintenanceAt, setLastMaintenanceAt] = useState('');

  const loadSchedule = useCallback(async () => {
    try { setSchedule(await getMaintenanceSchedule(deviceId)); }
    catch { setSchedule(null); }
  }, [deviceId]);

  useEffect(() => { void loadSchedule(); }, [loadSchedule]);

  // Sync schedule form when entering edit mode
  useEffect(() => {
    if (scheduleEditing) {
      setIntervalDays(schedule?.interval_days ? String(schedule.interval_days) : '180');
      setNotifyDaysBefore(schedule?.notify_days_before != null ? String(schedule.notify_days_before) : '7');
      setLastMaintenanceAt(schedule?.last_maintenance_at ? schedule.last_maintenance_at.split('T')[0] : '');
    }
  }, [scheduleEditing, schedule]);

  const handleSaveSchedule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const interval = Number.parseInt(intervalDays, 10);
    const notify = Number.parseInt(notifyDaysBefore, 10);
    if (!Number.isFinite(interval) || interval < 1) { setError('Chu kỳ phải là số nguyên dương'); return; }
    if (!Number.isFinite(notify) || notify < 0) { setError('Số ngày báo trước phải >= 0'); return; }
    if (notify > interval) { setError('Số ngày báo trước không được vượt chu kỳ'); return; }
    try {
      const sched = await upsertMaintenanceSchedule(deviceId, {
        interval_days: interval,
        notify_days_before: notify,
        last_maintenance_at: lastMaintenanceAt ? new Date(lastMaintenanceAt).toISOString() : undefined,
      });
      setSchedule(sched);
      setScheduleEditing(false);
      onChange?.();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Không thể lưu lịch bảo trì');
    }
  };

  const handleDeleteSchedule = async () => {
    if (!window.confirm('Xóa lịch bảo trì này?')) return;
    try {
      await deleteMaintenanceSchedule(deviceId);
      setSchedule(null);
      onChange?.();
    } catch { setError('Không thể xóa lịch bảo trì'); }
  };

  const statusBadge = maintenanceStatus === 'needs_maintenance' ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" /> Cần bảo trì
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Đang sử dụng
    </span>
  );

  return (
    <div className="card-glass border border-slate-100 shadow-sm p-6 md:p-8 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Cài đặt bảo trì
        </h2>
        {statusBadge}
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">{error}</div>
      )}

      {/* Schedule block */}
      <div className="bg-amber-50/40 rounded-2xl p-4 border border-amber-100">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Lịch bảo trì</p>
            {schedule ? (
              <div className="mt-1 text-sm text-slate-700 space-y-0.5">
                <p>Ngày kế tiếp: <span className="font-semibold">{new Date(schedule.next_due_at).toLocaleDateString('vi-VN')}</span></p>
                <p>Chu kỳ: <span className="font-semibold">{schedule.interval_days} ngày</span> · Báo trước: <span className="font-semibold">{schedule.notify_days_before} ngày</span></p>
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-500 italic">Chưa thiết lập lịch bảo trì.</p>
            )}
          </div>
          <div className="flex gap-2">
            {!scheduleEditing && (
              <button
                onClick={() => setScheduleEditing(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors"
              >
                {schedule ? 'Chỉnh sửa' : 'Thiết lập'}
              </button>
            )}
            {schedule && !scheduleEditing && (
              <button
                onClick={handleDeleteSchedule}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              >
                Xóa
              </button>
            )}
          </div>
        </div>

        {scheduleEditing && (
          <form onSubmit={handleSaveSchedule} className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">Chu kỳ (ngày)</label>
              <input type="number" min={1} value={intervalDays} onChange={e => setIntervalDays(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">Báo trước (ngày)</label>
              <input type="number" min={0} value={notifyDaysBefore} onChange={e => setNotifyDaysBefore(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">Ngày bảo trì gần nhất</label>
              <VnDatePicker
                value={lastMaintenanceAt}
                onChange={setLastMaintenanceAt}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 text-left flex items-center justify-between gap-2"
              />
            </div>
            <div className="md:col-span-3 flex gap-2 justify-end">
              <button type="button" onClick={() => setScheduleEditing(false)}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50">
                Hủy
              </button>
              <button type="submit"
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                Lưu
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

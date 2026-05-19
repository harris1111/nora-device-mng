import { useState, useEffect, useCallback } from 'react';
import {
  getInventorySchedule,
  upsertInventorySchedule,
  deleteInventorySchedule,
  InventorySchedule,
} from '../../api/device-api';
import VnDatePicker from '../ui/vn-date-picker';

interface Props {
  deviceId: string;
  /** Current inventory status as reported by the device record (drives the chip color). */
  inventoryStatus?: 'in_use' | 'needs_inventory';
  /** Notify parent when something changed so it can refetch the device. */
  onChange?: () => void;
}

export default function InventorySection({ deviceId, inventoryStatus, onChange }: Props) {
  const [schedule, setSchedule] = useState<InventorySchedule | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [scheduleEditing, setScheduleEditing] = useState(false);
  const [intervalDays, setIntervalDays] = useState('365');
  const [notifyDaysBefore, setNotifyDaysBefore] = useState('7');
  const [lastInventoryAt, setLastInventoryAt] = useState('');

  const loadSchedule = useCallback(async () => {
    try { setSchedule(await getInventorySchedule(deviceId)); }
    catch { setSchedule(null); }
  }, [deviceId]);

  useEffect(() => { void loadSchedule(); }, [loadSchedule]);

  useEffect(() => {
    if (scheduleEditing) {
      setIntervalDays(schedule?.interval_days ? String(schedule.interval_days) : '365');
      setNotifyDaysBefore(schedule?.notify_days_before != null ? String(schedule.notify_days_before) : '7');
      setLastInventoryAt(schedule?.last_inventory_at ? schedule.last_inventory_at.split('T')[0] : '');
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
      const sched = await upsertInventorySchedule(deviceId, {
        interval_days: interval,
        notify_days_before: notify,
        last_inventory_at: lastInventoryAt ? new Date(lastInventoryAt).toISOString() : undefined,
      });
      setSchedule(sched);
      setScheduleEditing(false);
      onChange?.();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Không thể lưu lịch kiểm kê');
    }
  };

  const handleDeleteSchedule = async () => {
    if (!window.confirm('Xóa lịch kiểm kê này?')) return;
    try {
      await deleteInventorySchedule(deviceId);
      setSchedule(null);
      onChange?.();
    } catch { setError('Không thể xóa lịch kiểm kê'); }
  };

  const statusBadge = inventoryStatus === 'needs_inventory' ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
      <span className="w-1.5 h-1.5 bg-sky-500 rounded-full" /> Cần kiểm kê
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
          <svg className="w-5 h-5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          Cài đặt kiểm kê
        </h2>
        {statusBadge}
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">{error}</div>
      )}

      <div className="bg-sky-50/40 rounded-2xl p-4 border border-sky-100">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-sky-700 uppercase tracking-wide">Lịch kiểm kê</p>
            {schedule ? (
              <div className="mt-1 text-sm text-slate-700 space-y-0.5">
                <p>Ngày kế tiếp: <span className="font-semibold">{new Date(schedule.next_due_at).toLocaleDateString('vi-VN')}</span></p>
                <p>Chu kỳ: <span className="font-semibold">{schedule.interval_days} ngày</span> · Báo trước: <span className="font-semibold">{schedule.notify_days_before} ngày</span></p>
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-500 italic">Chưa thiết lập lịch kiểm kê.</p>
            )}
          </div>
          <div className="flex gap-2">
            {!scheduleEditing && (
              <button
                onClick={() => setScheduleEditing(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-sky-200 text-sky-700 hover:bg-sky-50 transition-colors"
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
              <label className="block text-xs font-semibold text-slate-600">Ngày kiểm kê gần nhất</label>
              <VnDatePicker
                value={lastInventoryAt}
                onChange={setLastInventoryAt}
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

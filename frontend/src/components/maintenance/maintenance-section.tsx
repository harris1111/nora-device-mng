import { useState, useEffect, useCallback } from 'react';
import {
  getMaintenanceSchedule,
  upsertMaintenanceSchedule,
  deleteMaintenanceSchedule,
  getMaintenanceTasks,
  createMaintenanceTask,
  updateMaintenanceTask,
  deleteMaintenanceTask,
  maintenanceTaskAttachmentUrl,
  MaintenanceSchedule,
  MaintenanceTask,
  MaintenanceTaskAttachment,
  MaintenancePeriod,
} from '../../api/device-api';
import PdfViewerModal from '../attachment/pdf-viewer-modal';
import VnDatePicker from '../ui/vn-date-picker';

interface Props {
  deviceId: string;
  /** Current maintenance status as reported by the device record (drives the chip color). */
  maintenanceStatus?: 'in_use' | 'needs_maintenance';
  /** Notify parent when something changed so it can refetch the device. */
  onChange?: () => void;
}

const PERIOD_OPTIONS: { value: MaintenancePeriod; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'week', label: 'Tuần' },
  { value: 'month', label: 'Tháng' },
  { value: 'year', label: 'Năm' },
];

export default function MaintenanceSection({ deviceId, maintenanceStatus, onChange }: Props) {
  const [schedule, setSchedule] = useState<MaintenanceSchedule | null>(null);
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [period, setPeriod] = useState<MaintenancePeriod>('');
  const [error, setError] = useState<string | null>(null);
  const [pdfModal, setPdfModal] = useState<{ url: string; name: string } | null>(null);

  // Schedule form state
  const [scheduleEditing, setScheduleEditing] = useState(false);
  const [intervalDays, setIntervalDays] = useState('180');
  const [notifyDaysBefore, setNotifyDaysBefore] = useState('7');
  const [lastMaintenanceAt, setLastMaintenanceAt] = useState('');

  // Task form state
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDate, setTaskDate] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskTechnician, setTaskTechnician] = useState('');
  const [taskStatus, setTaskStatus] = useState<'pending' | 'completed'>('pending');
  const [taskFiles, setTaskFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadSchedule = useCallback(async () => {
    try { setSchedule(await getMaintenanceSchedule(deviceId)); }
    catch { setSchedule(null); }
  }, [deviceId]);

  const loadTasks = useCallback(async () => {
    try { setTasks(await getMaintenanceTasks(deviceId, period)); }
    catch { setTasks([]); }
  }, [deviceId, period]);

  useEffect(() => { void loadSchedule(); }, [loadSchedule]);
  useEffect(() => { void loadTasks(); }, [loadTasks]);

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

  const resetTaskForm = () => {
    setEditingTaskId(null);
    setTaskDate('');
    setTaskDescription('');
    setTaskTechnician('');
    setTaskStatus('pending');
    setTaskFiles([]);
    setTaskFormOpen(false);
  };

  const handleEditTask = (t: MaintenanceTask) => {
    setEditingTaskId(t.id);
    setTaskDate(t.date.split('T')[0]);
    setTaskDescription(t.description);
    setTaskTechnician(t.technician || '');
    setTaskStatus((t.status === 'completed' ? 'completed' : 'pending'));
    setTaskFormOpen(true);
  };

  const handleSubmitTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!taskDate || !taskDescription.trim()) { setError('Ngày và mô tả là bắt buộc'); return; }
    setSubmitting(true);
    setError(null);
    try {
      if (editingTaskId) {
        await updateMaintenanceTask(editingTaskId, {
          date: taskDate,
          description: taskDescription.trim(),
          technician: taskTechnician.trim() || null,
          status: taskStatus,
        });
      } else {
        const fd = new FormData();
        fd.append('date', taskDate);
        fd.append('description', taskDescription.trim());
        if (taskTechnician.trim()) fd.append('technician', taskTechnician.trim());
        fd.append('status', taskStatus);
        taskFiles.forEach(f => fd.append('files', f));
        await createMaintenanceTask(deviceId, fd);
      }
      resetTaskForm();
      await Promise.all([loadTasks(), loadSchedule()]);
      onChange?.();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Không thể lưu bản ghi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('Xóa bản ghi bảo trì này?')) return;
    try {
      await deleteMaintenanceTask(id);
      await loadTasks();
    } catch { setError('Không thể xóa bản ghi'); }
  };

  const openAttachment = (a: MaintenanceTaskAttachment) => {
    const url = maintenanceTaskAttachmentUrl(a.id);
    if (a.file_type === 'application/pdf') setPdfModal({ url, name: a.file_name });
    else window.open(url, '_blank', 'noopener,noreferrer');
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
      {pdfModal && <PdfViewerModal url={pdfModal.url} fileName={pdfModal.name} onClose={() => setPdfModal(null)} />}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Bảo trì thiết bị
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

      {/* Tasks block */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <p className="text-sm font-semibold text-slate-700">Lịch sử bảo trì ({tasks.length})</p>
          <div className="flex items-center gap-2">
            <select value={period} onChange={e => setPeriod(e.target.value as MaintenancePeriod)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500">
              {PERIOD_OPTIONS.map(opt => <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>)}
            </select>
            <button
              onClick={() => { resetTaskForm(); setTaskFormOpen(true); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Thêm
            </button>
          </div>
        </div>

        {taskFormOpen && (
          <form onSubmit={handleSubmitTask} className="bg-amber-50/40 rounded-2xl p-4 border border-amber-100 space-y-3 mb-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800">{editingTaskId ? 'Chỉnh sửa' : 'Thêm'} bảo trì</h3>
              <button type="button" onClick={resetTaskForm} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <VnDatePicker
                value={taskDate}
                onChange={setTaskDate}
                required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 text-left flex items-center justify-between gap-2"
              />
              <input type="text" placeholder="Kỹ thuật viên" value={taskTechnician} onChange={e => setTaskTechnician(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <textarea placeholder="Mô tả công việc bảo trì *" value={taskDescription} onChange={e => setTaskDescription(e.target.value)} required rows={2}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 resize-none" />
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-600">Trạng thái</label>
              <select value={taskStatus} onChange={e => setTaskStatus(e.target.value as 'pending' | 'completed')}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                <option value="pending">Đang chờ</option>
                <option value="completed">Hoàn thành</option>
              </select>
            </div>
            {!editingTaskId && (
              <div>
                {taskFiles.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {taskFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between py-1 px-2 bg-white rounded border border-slate-100 text-xs">
                        <span className="truncate text-slate-600">{f.name} ({(f.size / 1024).toFixed(0)} KB)</span>
                        <button type="button" onClick={() => setTaskFiles(prev => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer border bg-white text-slate-600 border-slate-200 hover:bg-slate-50">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Đính kèm tệp
                  <input type="file" multiple accept="image/*,application/pdf" className="hidden"
                    onChange={e => { const sel = Array.from(e.target.files || []); if (sel.length) setTaskFiles(p => [...p, ...sel].slice(0, 5)); e.target.value = ''; }} />
                </label>
                <span className="text-xs text-slate-400 ml-2">Tối đa 5 tệp</span>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={resetTaskForm}
                className="px-4 py-2 bg-white text-slate-600 text-sm font-semibold rounded-lg border border-slate-200 hover:bg-slate-50">Hủy</button>
              <button type="submit" disabled={submitting}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-slate-300">
                {submitting ? 'Đang lưu...' : (editingTaskId ? 'Cập nhật' : 'Thêm')}
              </button>
            </div>
          </form>
        )}

        {tasks.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Chưa có bản ghi bảo trì nào{period ? ' trong khoảng thời gian này' : ''}.</p>
        ) : (
          <div className="space-y-3">
            {tasks.map(t => (
              <div key={t.id} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm group">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{t.description}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-400">
                      <span>{new Date(t.date).toLocaleDateString('vi-VN')}</span>
                      {t.technician && <span>bởi {t.technician}</span>}
                      <span className={`px-1.5 py-0.5 rounded ${t.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {t.status === 'completed' ? 'Hoàn thành' : 'Đang chờ'}
                      </span>
                    </div>
                    {t.attachments?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {t.attachments.map(a => (
                          <button key={a.id} onClick={() => openAttachment(a)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                              a.file_type === 'application/pdf' ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`} title={a.file_name}>
                            <span className="truncate max-w-[120px]">{a.file_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => handleEditTask(t)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button onClick={() => handleDeleteTask(t.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

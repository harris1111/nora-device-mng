import { useState } from 'react';
import { createMaintenanceRecord, deleteMaintenanceRecord, updateMaintenanceRecord, MaintenanceRecord } from '../api/device-api';

interface FormState {
  date: string;
  description: string;
  performed_by: string;
  cost: string;
}

interface Props {
  deviceId: string;
  records: MaintenanceRecord[];
  onUpdate?: () => void;
}

export default function MaintenanceHistory({ deviceId, records, onUpdate }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormState>({ date: '', description: '', performed_by: '', cost: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setFormData({ date: '', description: '', performed_by: '', cost: '' });
    setShowForm(false);
    setEditingId(null);
    setError(null);
  };

  const handleEdit = (record: MaintenanceRecord) => {
    setFormData({
      date: record.date?.split('T')[0] || '',
      description: record.description || '',
      performed_by: record.performed_by || '',
      cost: record.cost != null ? String(record.cost) : '',
    });
    setEditingId(record.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.date || !formData.description?.trim()) {
      setError('Ngày và mô tả là bắt buộc');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        date: formData.date,
        description: formData.description.trim(),
        performed_by: formData.performed_by.trim() || null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
      };
      if (editingId) {
        await updateMaintenanceRecord(editingId, payload);
      } else {
        await createMaintenanceRecord(deviceId, payload);
      }
      resetForm();
      onUpdate?.();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Không thể lưu bản ghi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Xóa bản ghi bảo trì này?')) return;
    try {
      await deleteMaintenanceRecord(id);
      onUpdate?.();
    } catch {
      setError('Không thể xóa bản ghi');
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">{error}</div>
      )}

      {/* Records list */}
      {records && records.length > 0 ? (
        <div className="space-y-0">
          {records.map((r, i) => (
            <div key={r.id} className="relative pl-8 pb-5 last:pb-0 group">
              {i < records.length - 1 && (
                <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-slate-200"></div>
              )}
              <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-400 flex items-center justify-center">
                <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{r.description}</p>
                    <div className="flex flex-wrap gap-x-4 mt-1.5 text-xs text-slate-400">
                      <span>{new Date(r.date).toLocaleDateString('vi-VN')}</span>
                      {r.performed_by && <span>bởi {r.performed_by}</span>}
                      {r.cost != null && <span>{Number(r.cost).toLocaleString('vi-VN')} đ</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(r)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(r.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !showForm && <p className="text-sm text-slate-400 italic">Chưa có lịch sử bảo trì.</p>
      )}

      {/* Form */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="bg-blue-50/50 rounded-2xl p-5 border border-blue-100 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800">{editingId ? 'Chỉnh sửa' : 'Thêm'} bảo trì</h3>
            <button type="button" onClick={resetForm} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="date" value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} required
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
            <input type="text" placeholder="Người thực hiện" value={formData.performed_by} onChange={e => setFormData(p => ({ ...p, performed_by: e.target.value }))}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <textarea placeholder="Mô tả công việc bảo trì *" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} required rows={2}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none" />
          <input type="number" placeholder="Chi phí (VNĐ)" value={formData.cost} onChange={e => setFormData(p => ({ ...p, cost: e.target.value }))}
            className="w-full sm:w-48 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          <div className="flex gap-2">
            <button type="submit" disabled={submitting}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 transition-colors">
              {submitting ? 'Đang lưu...' : (editingId ? 'Cập nhật' : 'Thêm')}
            </button>
            <button type="button" onClick={resetForm}
              className="px-4 py-2 bg-white text-slate-600 text-sm font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              Hủy
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 text-sm font-semibold rounded-xl hover:bg-blue-100 active:scale-95 transition-all border border-blue-200">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Thêm bảo trì
        </button>
      )}
    </div>
  );
}

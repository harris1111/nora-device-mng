import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createMaintenanceRecord, deleteMaintenanceRecord, updateMaintenanceRecord, deleteMaintenanceAttachment, MaintenanceRecord, MaintenanceAttachmentItem, maintenanceAttachmentUrl } from '../../api/device-api';
import PdfViewerModal from '../attachment/pdf-viewer-modal';
import VnDatePicker from '../ui/vn-date-picker';
import { useCan } from '../../hooks/use-permission';

interface FormState {
  date: string;
  description: string;
  technician: string;
}

interface Props {
  deviceId: string;
  records: MaintenanceRecord[];
  onUpdate?: () => void;
}

export default function MaintenanceHistory({ deviceId, records, onUpdate }: Props) {
  const canUpdate = useCan('maintenance_history', 'update');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormState>({ date: '', description: '', technician: '' });
  const [files, setFiles] = useState<File[]>([]);
  // Existing attachments shown in the edit modal; lets users delete them.
  const [editingAttachments, setEditingAttachments] = useState<MaintenanceAttachmentItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfModal, setPdfModal] = useState<{ url: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Completion modal state
  const [completeTarget, setCompleteTarget] = useState<MaintenanceRecord | null>(null);
  const [completeTechnician, setCompleteTechnician] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');
  const [completeFiles, setCompleteFiles] = useState<File[]>([]);
  const [completing, setCompleting] = useState(false);
  const completeFileRef = useRef<HTMLInputElement>(null);

  const openCompleteModal = (r: MaintenanceRecord) => {
    setCompleteTarget(r);
    setCompleteTechnician(r.technician || '');
    setCompleteNotes(r.description || '');
    setCompleteFiles([]);
    setError(null);
  };

  const closeCompleteModal = () => {
    setCompleteTarget(null);
    setCompleteTechnician('');
    setCompleteNotes('');
    setCompleteFiles([]);
  };

  const handleComplete = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!completeTarget) return;
    if (!completeTechnician.trim()) { setError('Kỹ thuật viên là bắt buộc'); return; }
    if (!completeNotes.trim()) { setError('Ghi chú là bắt buộc'); return; }
    setCompleting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('status', 'completed');
      fd.append('technician', completeTechnician.trim());
      fd.append('description', completeNotes.trim());
      completeFiles.forEach(f => fd.append('files', f));
      await updateMaintenanceRecord(completeTarget.id, fd);
      closeCompleteModal();
      onUpdate?.();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Không thể hoàn thành bản ghi');
    } finally {
      setCompleting(false);
    }
  };

  const handleViewAttachment = (a: MaintenanceAttachmentItem) => {
    const url = maintenanceAttachmentUrl(a.id);
    if (a.file_type === 'application/pdf') {
      setPdfModal({ url, name: a.file_name });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const resetForm = () => {
    setFormData({ date: '', description: '', technician: '' });
    setFiles([]);
    setEditingAttachments([]);
    setShowForm(false);
    setEditingId(null);
    setError(null);
  };

  const handleEdit = (record: MaintenanceRecord) => {
    setFormData({
      date: record.date?.split('T')[0] || '',
      description: record.description || '',
      technician: record.technician || '',
    });
    setEditingAttachments(record.attachments || []);
    setFiles([]);
    setEditingId(record.id);
    setShowForm(true);
  };

  const handleRemoveExistingAttachment = async (id: string) => {
    if (!window.confirm('Xóa tệp đính kèm này?')) return;
    try {
      await deleteMaintenanceAttachment(id);
      setEditingAttachments(prev => prev.filter(a => a.id !== id));
      onUpdate?.();
    } catch {
      setError('Không thể xóa tệp đính kèm');
    }
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
      const fd = new FormData();
      fd.append('date', formData.date);
      fd.append('description', formData.description.trim());
      fd.append('technician', formData.technician.trim());
      files.forEach(f => fd.append('files', f));
      if (editingId) {
        await updateMaintenanceRecord(editingId, fd);
      } else {
        await createMaintenanceRecord(deviceId, fd);
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
    if (!window.confirm('Xóa bản ghi sửa chữa này?')) return;
    try {
      await deleteMaintenanceRecord(id);
      onUpdate?.();
    } catch {
      setError('Không thể xóa bản ghi');
    }
  };

  return (
    <div className="space-y-4">
      {pdfModal && <PdfViewerModal url={pdfModal.url} fileName={pdfModal.name} onClose={() => setPdfModal(null)} />}
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
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{r.description}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-400">
                      <span>{new Date(r.date).toLocaleDateString('vi-VN')}</span>
                      {r.technician && <span>bởi {r.technician}</span>}
                      <span className={`px-1.5 py-0.5 rounded font-semibold ${r.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {r.status === 'completed' ? 'Hoàn thành' : 'Đang chờ'}
                      </span>
                    </div>
                    {r.attachments?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.attachments.map(a => (
                          <button key={a.id} onClick={() => handleViewAttachment(a)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                              a.file_type === 'application/pdf'
                                ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`} title={a.file_name}>
                            {a.file_type === 'application/pdf' ? (
                              <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h6v6h6v10H6z"/><path d="M8 12h8v2H8zm0 3h8v2H8z"/></svg>
                            ) : (
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            )}
                            <span className="truncate max-w-[120px]">{a.file_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 items-center shrink-0">
                    {r.status !== 'completed' && canUpdate && (
                      <button onClick={() => openCompleteModal(r)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                        Hoàn thành
                      </button>
                    )}
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
            </div>
          ))}
        </div>
      ) : (
        !showForm && <p className="text-sm text-slate-400 italic">Chưa có lịch sử sửa chữa.</p>
      )}

      <button onClick={() => { resetForm(); setShowForm(true); }}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 text-sm font-semibold rounded-xl hover:bg-blue-100 active:scale-95 transition-all border border-blue-200">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        Thêm sửa chữa
      </button>

      {/* Add/Edit modal — full-screen overlay via portal (brief-v5) */}
      {showForm && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={resetForm}>
          <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-800">{editingId ? 'Chỉnh sửa' : 'Thêm'} sửa chữa</h3>
              <button type="button" onClick={resetForm} className="text-slate-400 hover:text-slate-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">{error}</div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">Ngày *</label>
                  <VnDatePicker
                    value={formData.date}
                    onChange={(v) => setFormData(p => ({ ...p, date: v }))}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-left flex items-center justify-between gap-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">Kỹ thuật viên</label>
                  <input type="text" placeholder="Tên kỹ thuật viên" value={formData.technician} onChange={e => setFormData(p => ({ ...p, technician: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">Mô tả *</label>
                <textarea placeholder="Mô tả công việc sửa chữa" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} required rows={3}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none" />
              </div>

              {/* Existing attachments — only in edit mode */}
              {editingId && editingAttachments.length > 0 && (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">Tệp đính kèm hiện có</label>
                  <div className="space-y-1">
                    {editingAttachments.map(a => (
                      <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                        <button type="button" onClick={() => handleViewAttachment(a)}
                          className="flex-1 min-w-0 text-left text-slate-700 hover:text-indigo-600 truncate">
                          {a.file_name}
                        </button>
                        <span className="text-xs text-slate-400 shrink-0">{(a.file_size / 1024).toFixed(0)} KB</span>
                        <button type="button" onClick={() => handleRemoveExistingAttachment(a.id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded shrink-0" title="Xóa tệp đính kèm">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New file upload (available in both create AND edit modes per brief-v5) */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">{editingId ? 'Thêm tệp đính kèm mới' : 'Tệp đính kèm'}</label>
                {files.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between py-1 px-2 bg-emerald-50 rounded border border-emerald-100 text-xs">
                        <span className="truncate text-slate-700">{f.name} ({(f.size / 1024).toFixed(0)} KB)</span>
                        <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 ml-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0 }}
                  onChange={e => {
                    const selected = Array.from(e.target.files || []);
                    if (selected.length > 0) {
                      const remaining = Math.max(0, 5 - editingAttachments.length - files.length);
                      setFiles(prev => [...prev, ...selected.slice(0, remaining)]);
                    }
                    e.target.value = '';
                  }} />
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  disabled={editingAttachments.length + files.length >= 5}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer border bg-white text-slate-600 border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Đính kèm tệp
                </button>
                <span className="text-xs text-slate-400 ml-2">Tối đa 5 tệp tổng cộng</span>
              </div>
            </div>
            <div className="flex gap-2 justify-end px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button type="button" onClick={resetForm}
                className="px-4 py-2 bg-white text-slate-600 text-sm font-semibold rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                Hủy
              </button>
              <button type="submit" disabled={submitting}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 transition-colors">
                {submitting ? 'Đang lưu...' : (editingId ? 'Cập nhật' : 'Thêm')}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* Completion modal — full-screen overlay via portal (brief-v5) */}
      {completeTarget && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={closeCompleteModal}>
          <form onSubmit={handleComplete} onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Hoàn thành bảo trì</h3>
              <button type="button" onClick={closeCompleteModal} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">{error}</div>
            )}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">Kỹ thuật viên *</label>
              <input type="text" value={completeTechnician} onChange={e => setCompleteTechnician(e.target.value)} required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">Ghi chú *</label>
              <textarea value={completeNotes} onChange={e => setCompleteNotes(e.target.value)} required rows={3}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">Tệp đính kèm</label>
              {completeFiles.length > 0 && (
                <div className="space-y-1 mb-2">
                  {completeFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between py-1 px-2 bg-slate-50 rounded border border-slate-100 text-xs">
                      <span className="truncate text-slate-600">{f.name} ({(f.size / 1024).toFixed(0)} KB)</span>
                      <button type="button" onClick={() => setCompleteFiles(prev => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input ref={completeFileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0 }}
                onChange={e => {
                  const sel = Array.from(e.target.files || []);
                  if (sel.length) setCompleteFiles(prev => [...prev, ...sel].slice(0, 5));
                  e.target.value = '';
                }} />
              <button type="button" onClick={() => completeFileRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer border bg-white text-slate-600 border-slate-200 hover:bg-slate-50">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Thêm tệp
              </button>
              <span className="text-xs text-slate-400 ml-2">Tối đa 5 tệp</span>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={closeCompleteModal}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50">
                Hủy
              </button>
              <button type="submit" disabled={completing}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-300">
                {completing ? 'Đang lưu...' : 'Hoàn thành'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
}

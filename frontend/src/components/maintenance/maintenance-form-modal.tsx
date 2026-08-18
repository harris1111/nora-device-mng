import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import PdfViewerModal from '../attachment/pdf-viewer-modal';

export interface MaintenanceAttachmentLike {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface MaintenanceRecordLike {
  id: string;
  date: string;
  description: string;
  technician: string | null;
  status: string;
  attachments: MaintenanceAttachmentLike[];
}

export type MaintenanceFormMode = 'create' | 'edit' | 'complete';

export interface MaintenanceFormApi {
  create: (formData: FormData) => Promise<unknown>;
  update: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  uploadAttachments: (id: string, files: File[]) => Promise<unknown>;
  deleteAttachment: (id: string) => Promise<unknown>;
  viewAttachmentUrl: (id: string) => string;
}

interface Props {
  open: boolean;
  mode: MaintenanceFormMode;
  /** Vietnamese type label, e.g. 'sửa chữa' or 'bảo trì'. */
  typeLabel: string;
  record: MaintenanceRecordLike | null;
  api: MaintenanceFormApi;
  onClose: () => void;
  onSaved: () => void;
}

const MAX_ATTACHMENTS = 5;

export default function MaintenanceFormModal({ open, mode, typeLabel, record, api, onClose, onSaved }: Props) {
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [technician, setTechnician] = useState('');
  const [status, setStatus] = useState<'pending' | 'completed'>('pending');
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [existing, setExisting] = useState<MaintenanceAttachmentLike[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfModal, setPdfModal] = useState<{ url: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Reset form whenever the modal opens or the underlying record changes
  useEffect(() => {
    if (!open) return;
    if (record) {
      setDate(record.date?.split('T')[0] || '');
      setDescription(record.description || '');
      setTechnician(record.technician || '');
      setStatus(mode === 'complete' ? 'completed' : (record.status === 'completed' ? 'completed' : 'pending'));
      setExisting(record.attachments || []);
    } else {
      setDate(new Date().toISOString().split('T')[0]);
      setDescription('');
      setTechnician('');
      setStatus(mode === 'complete' ? 'completed' : 'pending');
      setExisting([]);
    }
    setNewFiles([]);
    setError(null);
  }, [open, record, mode]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const totalAttachmentCount = existing.length + newFiles.length;

  const handleViewAttachment = (a: MaintenanceAttachmentLike) => {
    const url = api.viewAttachmentUrl(a.id);
    if (a.file_type === 'application/pdf') setPdfModal({ url, name: a.file_name });
    else window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleRemoveExisting = async (id: string) => {
    if (!window.confirm('Xóa tệp đính kèm này?')) return;
    try {
      await api.deleteAttachment(id);
      setExisting(prev => prev.filter(a => a.id !== id));
    } catch {
      setError('Không thể xóa tệp đính kèm');
    }
  };

  const handlePickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length) {
      const remaining = Math.max(0, MAX_ATTACHMENTS - totalAttachmentCount);
      setNewFiles(prev => [...prev, ...picked.slice(0, remaining)]);
    }
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!date || !description.trim()) {
      setError('Ngày và mô tả là bắt buộc');
      return;
    }
    if (totalAttachmentCount > MAX_ATTACHMENTS) {
      setError(`Tối đa ${MAX_ATTACHMENTS} tệp đính kèm`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (record) {
        await api.update(record.id, {
          date,
          description: description.trim(),
          technician: technician.trim() || null,
          status,
        });
        if (newFiles.length) await api.uploadAttachments(record.id, newFiles);
      } else {
        const fd = new FormData();
        fd.append('date', date);
        fd.append('description', description.trim());
        if (technician.trim()) fd.append('technician', technician.trim());
        fd.append('status', status);
        newFiles.forEach(f => fd.append('files', f));
        await api.create(fd);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Không thể lưu bản ghi');
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === 'create'
    ? `Thêm ${typeLabel}`
    : mode === 'complete'
      ? `Hoàn thành ${typeLabel}`
      : `Chỉnh sửa ${typeLabel}`;

  const submitLabel = submitting
    ? 'Đang lưu...'
    : mode === 'complete'
      ? 'Xác nhận hoàn thành'
      : mode === 'create' ? 'Thêm' : 'Cập nhật';

  const modalContent = (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" role="dialog" aria-modal="true">
      {pdfModal && <PdfViewerModal url={pdfModal.url} fileName={pdfModal.name} onClose={() => setPdfModal(null)} />}

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body (scrollable) */}
        <form ref={formRef} onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">{error}</div>
          )}

          {mode === 'complete' && (
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm border border-emerald-100">
              Xác nhận hoàn thành {typeLabel} cho thiết bị. Bạn có thể cập nhật mô tả, kỹ thuật viên và đính kèm thêm tệp trước khi xác nhận.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">Ngày *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">Kỹ thuật viên</label>
              <input type="text" placeholder="Nhập tên kỹ thuật viên" value={technician} onChange={e => setTechnician(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-600">Mô tả *</label>
            <textarea placeholder={`Mô tả công việc ${typeLabel}`} value={description} onChange={e => setDescription(e.target.value)} required rows={3}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none" />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-600">Trạng thái</label>
            <select value={status} onChange={e => setStatus(e.target.value as 'pending' | 'completed')}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              <option value="pending">Đang chờ</option>
              <option value="completed">Hoàn thành</option>
            </select>
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-600">Tệp đính kèm ({totalAttachmentCount}/{MAX_ATTACHMENTS})</label>
              <span className="text-xs text-slate-400">Ảnh hoặc PDF, tối đa 10MB / tệp</span>
            </div>

            {existing.length > 0 && (
              <div className="space-y-1">
                {existing.map(a => (
                  <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                    <button type="button" onClick={() => handleViewAttachment(a)}
                      className="flex-1 min-w-0 text-left text-slate-700 hover:text-indigo-600 truncate">
                      {a.file_name}
                    </button>
                    <span className="text-xs text-slate-400 shrink-0">{(a.file_size / 1024).toFixed(0)} KB</span>
                    <button type="button" onClick={() => handleRemoveExisting(a.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors shrink-0" title="Xóa tệp đính kèm">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {newFiles.length > 0 && (
              <div className="space-y-1">
                {newFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-100 text-sm">
                    <span className="flex-1 min-w-0 text-slate-700 truncate">{f.name}</span>
                    <span className="text-xs text-slate-500 shrink-0">{(f.size / 1024).toFixed(0)} KB · mới</span>
                    <button type="button" onClick={() => setNewFiles(prev => prev.filter((_, j) => j !== i))}
                      className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors shrink-0" title="Bỏ tệp">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              className="hidden" onChange={handlePickFiles} />
            <button type="button"
              disabled={totalAttachmentCount >= MAX_ATTACHMENTS}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border bg-white text-slate-600 border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Thêm tệp đính kèm
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button type="button" onClick={onClose}
            className="px-4 py-2 bg-white text-slate-600 text-sm font-semibold rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
            Hủy
          </button>
          <button type="button" onClick={() => formRef.current?.requestSubmit()} disabled={submitting}
            className={`px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:bg-slate-300 transition-colors ${
              mode === 'complete' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}>
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

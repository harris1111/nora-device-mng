import { useState, useRef } from 'react';
import { attachmentFileUrl, maintenanceAttachmentUrl, Attachment, MaintenanceAttachmentItem, TransferAttachmentItem } from '../../api/device-api';
import PdfViewerModal from './pdf-viewer-modal';

type AnyAttachment = Attachment | MaintenanceAttachmentItem | TransferAttachmentItem;

interface Props {
  attachments: AnyAttachment[];
  onDelete?: (id: string) => void;
  onSetPrimary?: (id: string) => void;
  onUpload?: (files: File[]) => Promise<void>;
  uploading?: boolean;
  maxFiles?: number;
  allowUpload?: boolean;
  maintenanceMode?: boolean;
  fileUrlResolver?: (attachment: AnyAttachment) => string;
  emptyText?: string;
  uploadButtonLabel?: string;
}

function isDeviceAttachment(a: AnyAttachment): a is Attachment {
  return 'device_id' in a;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdf(type: string): boolean {
  return type === 'application/pdf';
}

function isImage(type: string): boolean {
  return type.startsWith('image/');
}

function getFileUrl(a: AnyAttachment, maintenanceMode: boolean, fileUrlResolver?: (attachment: AnyAttachment) => string): string {
  if (fileUrlResolver) return fileUrlResolver(a);
  return maintenanceMode ? maintenanceAttachmentUrl(a.id) : attachmentFileUrl(a.id);
}

export default function AttachmentList({ attachments, onDelete, onSetPrimary, onUpload, uploading, maxFiles, allowUpload, maintenanceMode, fileUrlResolver, emptyText = 'Chưa có tệp đính kèm', uploadButtonLabel = 'Tải lên tệp' }: Props) {
  const [pdfModal, setPdfModal] = useState<{ url: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleView = (a: AnyAttachment) => {
    const url = getFileUrl(a, !!maintenanceMode, fileUrlResolver);
    if (isPdf(a.file_type)) {
      setPdfModal({ url, name: a.file_name });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !onUpload) return;
    await onUpload(files);
    e.target.value = '';
  };

  return (
    <div className="space-y-3">
      {pdfModal && <PdfViewerModal url={pdfModal.url} fileName={pdfModal.name} onClose={() => setPdfModal(null)} />}

      {attachments.length > 0 ? (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Tên tệp</th>
                <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Loại</th>
                <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Kích thước</th>
                <th className="px-4 py-2.5 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attachments.map(a => {
                const devAttachment = isDeviceAttachment(a) ? a : null;
                return (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {devAttachment?.is_primary && (
                          <span className="text-amber-500 shrink-0" title="Ảnh chính">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                          </span>
                        )}
                        <span className="truncate max-w-[200px]" title={a.file_name}>{a.file_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">
                      {isPdf(a.file_type) ? (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">PDF</span>
                      ) : isImage(a.file_type) ? (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Ảnh</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-50 text-slate-600 border border-slate-200">Tệp</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 hidden sm:table-cell">{formatSize(a.file_size)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleView(a)} title="Xem"
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                        {onSetPrimary && devAttachment && isImage(a.file_type) && !devAttachment.is_primary && (
                          <button onClick={() => onSetPrimary(a.id)} title="Đặt ảnh chính"
                            className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                          </button>
                        )}
                        {onDelete && (
                          <button onClick={() => { if (window.confirm('Xóa tệp này?')) onDelete(a.id); }} title="Xóa"
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-400 italic">{emptyText}</p>
      )}

      {/* Upload button + counter */}
      {allowUpload && onUpload && (
        <div className="flex items-center gap-3">
          <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            onChange={handleUploadChange} disabled={uploading}
            style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0 }} />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl cursor-pointer transition-all border ${uploading ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 active:scale-95'}`}>
            {uploading ? (
              <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg> Đang tải...</>
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> {uploadButtonLabel}</>
            )}
          </button>
          {maxFiles && <span className="text-xs text-slate-400">{attachments.length}/{maxFiles} tệp</span>}
        </div>
      )}
    </div>
  );
}

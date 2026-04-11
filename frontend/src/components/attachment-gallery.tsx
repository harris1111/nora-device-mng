import { useState } from 'react';
import { uploadAttachments, deleteAttachment, setAttachmentPrimary, attachmentFileUrl, Attachment } from '../api/device-api';

interface Props {
  deviceId: string;
  attachments: Attachment[];
  onUpdate?: () => void;
}

export default function AttachmentGallery({ deviceId, attachments, onUpdate }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      await uploadAttachments(deviceId, files);
      onUpdate?.();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Không thể tải lên tệp');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Xóa tệp đính kèm này?')) return;
    try {
      await deleteAttachment(id);
      onUpdate?.();
    } catch {
      setError('Không thể xóa tệp');
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      await setAttachmentPrimary(id);
      onUpdate?.();
    } catch {
      setError('Không thể đặt làm ảnh chính');
    }
  };

  const isImage = (type: string | null | undefined) => type?.startsWith('image/');

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">{error}</div>
      )}

      {/* Gallery grid */}
      {attachments && attachments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {attachments.map(a => (
            <div key={a.id} className={`relative group rounded-xl overflow-hidden border-2 transition-all ${a.is_primary ? 'border-indigo-400 shadow-md' : 'border-slate-200'}`}>
              {isImage(a.file_type) ? (
                <a href={attachmentFileUrl(a.id)} target="_blank" rel="noopener noreferrer">
                  <img src={attachmentFileUrl(a.id)} alt={a.file_name} className="w-full aspect-square object-cover" />
                </a>
              ) : (
                <a href={attachmentFileUrl(a.id)} target="_blank" rel="noopener noreferrer"
                  className="w-full aspect-square flex flex-col items-center justify-center bg-slate-50 text-slate-400 hover:bg-slate-100 transition-colors">
                  <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  <span className="text-xs px-2 truncate max-w-full">{a.file_name}</span>
                </a>
              )}
              {a.is_primary && (
                <span className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-md shadow">Ảnh chính</span>
              )}
              {/* Action overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-end justify-center opacity-0 group-hover:opacity-100 p-2 gap-1.5">
                {isImage(a.file_type) && !a.is_primary && (
                  <button onClick={() => handleSetPrimary(a.id)}
                    className="px-2 py-1 bg-white text-indigo-700 text-[10px] font-bold rounded-md shadow hover:bg-indigo-50 transition-colors">
                    Đặt chính
                  </button>
                )}
                <button onClick={() => handleDelete(a.id)}
                  className="px-2 py-1 bg-white text-red-600 text-[10px] font-bold rounded-md shadow hover:bg-red-50 transition-colors">
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <label className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl cursor-pointer transition-all border ${uploading ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 active:scale-95'}`}>
        {uploading ? (
          <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Đang tải...</>
        ) : (
          <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> Tải lên tệp</>
        )}
        <input type="file" multiple accept="image/*,.pdf" onChange={handleUpload} className="hidden" disabled={uploading} />
      </label>
      <p className="text-xs text-slate-400">Tối đa 10 tệp / thiết bị. JPG, PNG, WebP, GIF, PDF (≤ 10MB)</p>
    </div>
  );
}

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  url: string;
  fileName: string;
  onClose: () => void;
}

export default function PdfViewerModal({ url, fileName, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const modalContent = (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col" onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="flex flex-none items-center justify-between px-5 py-3 border-b border-slate-200">
        <h3 className="text-base font-semibold text-slate-700 truncate pr-4">{fileName}</h3>
        <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {/* Body */}
      <div className="flex-1 min-h-0 w-full bg-slate-100">
        <iframe src={url} title={fileName} className="w-full h-full border-0" />
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

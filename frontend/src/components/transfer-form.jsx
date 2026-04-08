import { useState, useEffect } from 'react';
import { transferDevice, getLocations } from '../api/device-api';

export default function TransferForm({ deviceId, currentOwner, onTransferred }) {
  const [toOwner, setToOwner] = useState('');
  const [transferredBy, setTransferredBy] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    getLocations().then(setLocations).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!toOwner) { setError('Người nhận là bắt buộc'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await transferDevice(deviceId, {
        to_owner: toOwner,
        transferred_by: transferredBy.trim(),
        note: note.trim(),
      });
      setToOwner('');
      setTransferredBy('');
      setNote('');
      setOpen(false);
      onTransferred(updated);
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể chuyển giao thiết bị');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 text-sm font-semibold rounded-xl hover:bg-amber-100 active:scale-95 transition-all border border-amber-200 shadow-sm"
      >
        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-xs font-bold tracking-wide">
          {currentOwner || '—'}
        </span>
        <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
        <span className="px-2 py-0.5 bg-white border border-amber-200 text-slate-400 rounded-md text-xs font-bold tracking-wide">?</span>
      </button>
    );
  }

  return (
    <div className="bg-amber-50/50 rounded-2xl p-6 border border-amber-100">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Chuyển giao thiết bị
        </h3>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Transfer flow indicator */}
      <div className="flex items-center gap-3 mb-5 p-3 bg-white rounded-xl border border-amber-100">
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Từ</span>
          <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold border border-slate-200">
            {currentOwner || '—'}
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-1">
            <div className="h-px w-6 bg-amber-300"></div>
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            <div className="h-px w-6 bg-amber-300"></div>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Đến</span>
          <span
            className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${
              toOwner
                ? 'bg-amber-500 text-white border-amber-600 shadow-sm shadow-amber-200'
                : 'bg-amber-50 text-amber-400 border-amber-200 border-dashed'
            }`}
          >
            {toOwner || '?'}
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 mb-4 bg-red-50 text-red-600 rounded-lg border border-red-100 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Chuyển cho <span className="text-red-500">*</span></label>
          <div className="relative">
            <select value={toOwner} onChange={(e) => setToOwner(e.target.value)} required
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all appearance-none cursor-pointer">
              <option value="" disabled>-- Chọn bộ phận nhận --</option>
              {locations.map((loc) => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Người thực hiện</label>
          <input type="text" value={transferredBy} onChange={(e) => setTransferredBy(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
            placeholder="Ví dụ: Nguyễn Văn A" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Ghi chú</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all resize-none"
            placeholder="Lý do chuyển giao..." />
        </div>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => setOpen(false)}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
            Hủy
          </button>
          <button type="submit" disabled={submitting}
            className="px-6 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-sm">
            {submitting ? 'Đang xử lý...' : 'Xác nhận chuyển giao'}
          </button>
        </div>
      </form>
    </div>
  );
}

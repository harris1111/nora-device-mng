import { useState, useEffect } from 'react';
import { getDeviceTransfers } from '../api/device-api';

export default function TransferHistory({ deviceId, refreshKey }) {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDeviceTransfers(deviceId)
      .then(setTransfers)
      .catch(() => setTransfers([]))
      .finally(() => setLoading(false));
  }, [deviceId, refreshKey]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
        <div className="h-12 bg-slate-200 rounded"></div>
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic">Chưa có lịch sử chuyển giao.</p>
    );
  }

  return (
    <div className="space-y-0">
      {transfers.map((t, i) => (
        <div key={t.id} className="relative pl-8 pb-6 last:pb-0 group">
          {/* Timeline line */}
          {i < transfers.length - 1 && (
            <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-slate-200"></div>
          )}
          {/* Timeline dot */}
          <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center">
            <svg className="w-3 h-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 text-sm mb-1">
              <span className="text-slate-500">{t.from_owner || '(Chưa gán)'}</span>
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              <span className="font-semibold text-slate-800">{t.to_owner}</span>
            </div>
            {t.note && <p className="text-sm text-slate-600 mt-1">{t.note}</p>}
            <div className="flex flex-wrap gap-x-4 mt-2 text-xs text-slate-400">
              <span>{new Date(t.transferred_at + 'Z').toLocaleString('vi-VN')}</span>
              {t.transferred_by && <span>bởi {t.transferred_by}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

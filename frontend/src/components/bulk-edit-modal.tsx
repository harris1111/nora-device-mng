import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { bulkEditDevices, getLocations, Location, Device } from '../api/device-api';
import { STATUS_BY_TYPE } from './device/device-constants';

interface Props {
  devices: Device[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkEditModal({ devices, onClose, onSuccess }: Props) {
  const [tab, setTab] = useState<'status' | 'transfer'>('status');
  const [status, setStatus] = useState('');
  const [ownedBy, setOwnedBy] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferDate, setTransferDate] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLocations().then(setLocations).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Determine which statuses are valid for the selected devices
  const deviceTypes = [...new Set(devices.map(d => d.type))];
  const isMixedType = deviceTypes.length > 1;

  // Only show statuses common to all selected device types
  const commonStatuses = isMixedType
    ? [] // Can't bulk change status on mixed types
    : (STATUS_BY_TYPE[deviceTypes[0]] || []);

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ids: devices.map(d => d.id) };

      if (tab === 'status') {
        if (!status) { setError('Vui lòng chọn trạng thái'); setSaving(false); return; }
        payload.status = status;
      } else {
        if (!ownedBy && !transferTo && !transferDate) {
          setError('Vui lòng nhập ít nhất một trường chuyển giao');
          setSaving(false);
          return;
        }
        if (ownedBy) payload.owned_by = ownedBy;
        if (transferTo !== undefined) payload.transfer_to = transferTo || null;
        if (transferDate) payload.transfer_date = transferDate;
      }

      await bulkEditDevices(payload as unknown as Parameters<typeof bulkEditDevices>[0]);
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Lỗi cập nhật';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Chỉnh sửa hàng loạt</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Đã chọn <span className="font-semibold text-indigo-600">{devices.length}</span> thiết bị
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setTab('status')}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
              tab === 'status'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Trạng thái
          </button>
          <button
            onClick={() => setTab('transfer')}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
              tab === 'transfer'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Chuyển giao
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm font-medium">
              {error}
            </div>
          )}

          {tab === 'status' && (
            <>
              {isMixedType ? (
                <div className="p-4 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 text-sm">
                  <span className="font-semibold">Lưu ý:</span> Không thể thay đổi trạng thái khi chọn thiết bị có nhiều loại khác nhau.
                  Vui lòng chọn thiết bị cùng loại.
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Trạng thái mới</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  >
                    <option value="">— Chọn trạng thái —</option>
                    {commonStatuses.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {tab === 'transfer' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Người sở hữu / quản lý</label>
                <input
                  type="text"
                  value={ownedBy}
                  onChange={e => setOwnedBy(e.target.value)}
                  placeholder="Nhập tên người quản lý..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Chuyển giao đến</label>
                <select
                  value={transferTo}
                  onChange={e => setTransferTo(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                >
                  <option value="">— Không chuyển giao —</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Ngày chuyển giao</label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={e => setTransferDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || (tab === 'status' && isMixedType)}
            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Đang lưu...' : 'Áp dụng'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

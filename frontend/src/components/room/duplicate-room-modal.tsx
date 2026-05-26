import { useState } from 'react';
import { duplicateRoom, type DuplicateRequest } from '../../api/room-api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  roomId: string;
  onDuplicated: () => void;
}

export default function DuplicateRoomModal({ isOpen, onClose, roomName, roomId, onDuplicated }: Props) {
  const [namePrefix, setNamePrefix] = useState(roomName);
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(1);
  const [cloneDevices, setCloneDevices] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const count = Math.max(0, rangeEnd - rangeStart + 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rangeStart > rangeEnd) { setError('Số bắt đầu phải <= số kết thúc'); return; }
    if (count > 100) { setError('Tối đa 100 phòng mỗi lần nhân bản'); return; }
    if (count < 1) { setError('Phạm vi không hợp lệ'); return; }

    setSubmitting(true);
    setError(null);
    try {
      await duplicateRoom(roomId, {
        range_start: rangeStart,
        range_end: rangeEnd,
        name_prefix: namePrefix.trim() || roomName,
        clone_devices: cloneDevices,
      });
      onDuplicated();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Nhân bản thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Nhân bản phòng</h3>
        <p className="text-sm text-slate-500 mb-4">Mẫu: {roomName}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Tiền tố tên phòng</label>
            <input
              type="text"
              value={namePrefix}
              onChange={e => setNamePrefix(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
              placeholder="VD: Phòng"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Từ số</label>
              <input
                type="number"
                value={rangeStart}
                onChange={e => setRangeStart(parseInt(e.target.value) || 0)}
                min={1}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Đến số</label>
              <input
                type="number"
                value={rangeEnd}
                onChange={e => setRangeEnd(parseInt(e.target.value) || 0)}
                min={1}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
              />
            </div>
          </div>

          {/* Preview */}
          {count > 0 && count <= 100 && (
            <div className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-700">
              Sẽ tạo <strong>{count}</strong> phòng: {namePrefix || roomName} {rangeStart}{count > 1 ? ` → ${namePrefix || roomName} ${rangeEnd}` : ''}
            </div>
          )}

          {/* Clone devices toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={cloneDevices}
              onChange={e => setCloneDevices(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-600">
              Sao chép thiết bị <span className="text-xs text-slate-400">(không bao gồm tệp đính kèm)</span>
            </span>
          </label>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm">{error}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-50">
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting || count < 1 || count > 100}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 rounded-xl shadow-sm shadow-indigo-200 flex items-center gap-2"
            >
              {submitting ? (
                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Đang tạo...</>
              ) : (
                `Nhân bản ${count} phòng`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

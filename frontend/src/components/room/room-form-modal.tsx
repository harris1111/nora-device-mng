import { useState } from 'react';
import type { FlatRoomNode } from '../../api/room-api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; code?: string; description?: string; parent_id?: string }) => void;
  parentId?: string | null;
  parentName?: string;
  rooms?: FlatRoomNode[];
}

export default function RoomFormModal({ isOpen, onClose, onSubmit, parentId, parentName, rooms }: Props) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [selectedParentId, setSelectedParentId] = useState(parentId || '');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      code: code.trim() || undefined,
      description: description.trim(),
      parent_id: selectedParentId || undefined,
    });
    setName('');
    setCode('');
    setDescription('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-800 mb-4">
          {parentId ? 'Thêm phòng con' : 'Tạo phòng mới'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Tên phòng</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
              placeholder="VD: Phòng 101"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Mã phòng (tùy chọn)</label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
              placeholder="VD: 101"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Mô tả (tùy chọn)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Phòng cha</label>
            {parentName ? (
              <p className="text-sm text-slate-500">{parentName}</p>
            ) : (
              <select
                value={selectedParentId}
                onChange={e => setSelectedParentId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
              >
                <option value="">-- Gốc (không có cha) --</option>
                {rooms?.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-50">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200">
              Tạo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

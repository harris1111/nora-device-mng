import { Link } from 'react-router-dom';
import type { RoomNodeResponse } from '../../api/room-api';
import RoomStatusBadge from './room-status-badge';

interface Props {
  room: RoomNodeResponse | null;
  loading: boolean;
  onRefresh: () => void;
}

export default function RoomDetailPanel({ room, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <svg className="h-16 w-16 mb-4 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <p className="text-sm font-medium">Chọn một phòng để xem thiết bị</p>
        <p className="text-xs mt-1">Nhấn vào tên phòng ở cây bên trái</p>
      </div>
    );
  }

  const isLeaf = room.children.length === 0;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800">{room.name}</h2>
            <RoomStatusBadge status={room.status} size="md" />
          </div>
          {room.code && <p className="text-sm text-slate-500 mt-0.5">Mã: {room.code}</p>}
          {room.description && <p className="text-sm text-slate-500 mt-0.5">{room.description}</p>}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-2xl font-bold text-slate-800">{room.deviceCount}</p>
          <p className="text-xs text-slate-500 mt-1">Thiết bị trong phòng</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-2xl font-bold text-slate-800">{room.children.length}</p>
          <p className="text-xs text-slate-500 mt-1">Phòng con</p>
        </div>
      </div>

      {/* Children list (for non-leaf nodes) */}
      {!isLeaf && room.children.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Phòng con</h3>
          <div className="space-y-1">
            {room.children.map(child => (
              <div key={child.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span className="font-medium text-slate-700">{child.name}</span>
                {child.code && <span className="text-xs text-slate-400">{child.code}</span>}
                {child.deviceCount > 0 && (
                  <span className="ml-auto text-xs text-slate-500">{child.deviceCount} thiết bị</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions for leaf rooms */}
      {isLeaf && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Link
              to={`/devices/new?roomId=${room.id}&isRoomDevice=true`}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Thêm thiết bị
            </Link>
          </div>

          {room.deviceCount > 0 ? (
            <p className="text-sm text-slate-500">
              {room.deviceCount} thiết bị trong phòng này. Thiết bị phòng được quản lý trong danh sách thiết bị chính với bộ lọc phòng.
            </p>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
              <p className="text-sm text-slate-500">Chưa có thiết bị nào trong phòng này.</p>
              <p className="text-xs text-slate-400 mt-1">Nhấn "Thêm thiết bị" để bắt đầu.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

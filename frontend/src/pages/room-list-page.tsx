import { useState, useCallback } from 'react';
import { useRoomTree } from '../hooks/use-room-tree';
import { createRoom, updateRoom, deleteRoom, getRoom, type RoomNodeResponse } from '../api/room-api';
import RoomTree from '../components/room/room-tree';
import RoomFormModal from '../components/room/room-form-modal';
import RoomDetailPanel from '../components/room/room-detail-panel';
import DuplicateRoomModal from '../components/room/duplicate-room-modal';

export default function RoomListPage() {
  const { expandedIds, selectedId, toggleExpand, selectRoom } = useRoomTree();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [createParentName, setCreateParentName] = useState<string | undefined>(undefined);
  const [selectedRoom, setSelectedRoom] = useState<RoomNodeResponse | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateRoomId, setDuplicateRoomId] = useState<string | null>(null);
  const [duplicateRoomName, setDuplicateRoomName] = useState('');

  // Load selected room detail
  const loadRoom = useCallback(async (id: string) => {
    setLoadingRoom(true);
    try {
      const room = await getRoom(id);
      setSelectedRoom(room);
    } catch {
      setSelectedRoom(null);
    } finally {
      setLoadingRoom(false);
    }
  }, []);

  const handleSelect = (id: string) => {
    selectRoom(id);
    loadRoom(id);
  };

  const handleRefresh = () => setRefreshKey(k => k + 1);

  const handleRename = async (id: string, name: string) => {
    try {
      await updateRoom(id, { name });
      handleRefresh();
      if (selectedId === id) loadRoom(id);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to rename room');
    }
  };

  const handleAddChild = (parentId: string) => {
    setCreateParentId(parentId);
    // Find parent name from tree for display
    setCreateParentName(undefined);
    setShowCreateModal(true);
  };

  const handleCreateRoot = () => {
    setCreateParentId(null);
    setCreateParentName(undefined);
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (data: { name: string; code?: string; description?: string; parent_id?: string }) => {
    try {
      await createRoom(data);
      setShowCreateModal(false);
      handleRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to create room');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa phòng này?')) return;
    try {
      await deleteRoom(id);
      if (selectedId === id) {
        setSelectedRoom(null);
        selectRoom('');
      }
      handleRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete room');
    }
  };

  const handleDuplicate = (id: string) => {
    const room = selectedRoom;
    setDuplicateRoomId(id);
    setDuplicateRoomName(room?.name || '');
    setShowDuplicateModal(true);
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Tree sidebar */}
      <div className="w-72 flex-shrink-0 border-r border-slate-100 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Sơ đồ phòng</h3>
          <button
            type="button"
            onClick={handleCreateRoot}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tạo mới
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <RoomTree
            expandedIds={expandedIds}
            selectedId={selectedId}
            onToggleExpand={toggleExpand}
            onSelect={handleSelect}
            onRename={handleRename}
            onAddChild={handleAddChild}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            refreshKey={refreshKey}
          />
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto">
        <RoomDetailPanel
          room={selectedRoom}
          loading={loadingRoom}
          onRefresh={() => { handleRefresh(); if (selectedId) loadRoom(selectedId); }}
        />
      </div>

      {/* Create modal */}
      <RoomFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateSubmit}
        parentId={createParentId}
        parentName={createParentName}
      />

      {/* Duplicate modal */}
      <DuplicateRoomModal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        roomName={duplicateRoomName}
        roomId={duplicateRoomId ?? ''}
        onDuplicated={() => { handleRefresh(); if (selectedId) loadRoom(selectedId); }}
      />
    </div>
  );
}

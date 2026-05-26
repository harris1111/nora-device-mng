import { useEffect, useState } from 'react';
import type { RoomNodeResponse } from '../../api/room-api';
import { getRoomTree } from '../../api/room-api';
import RoomTreeNode from './room-tree-node';

interface Props {
  expandedIds: string[];
  selectedId: string | null;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  refreshKey: number;
}

export default function RoomTree({
  expandedIds, selectedId, onToggleExpand, onSelect,
  onRename, onAddChild, onDelete, onDuplicate, refreshKey,
}: Props) {
  const [tree, setTree] = useState<RoomNodeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getRoomTree()
      .then(setTree)
      .catch((err) => setError(err?.response?.data?.error || 'Failed to load room tree'))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <p className="px-3 py-4 text-sm text-red-500">{error}</p>;
  }

  if (tree.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-sm text-slate-400">
        <p>Chưa có phòng nào.</p>
        <p className="mt-1">Nhấn "Tạo mới" để bắt đầu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {tree.map(node => (
        <RoomTreeNode
          key={node.id}
          node={node}
          depth={0}
          expandedIds={expandedIds}
          selectedId={selectedId}
          onToggleExpand={onToggleExpand}
          onSelect={onSelect}
          onRename={onRename}
          onAddChild={onAddChild}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
        />
      ))}
    </div>
  );
}

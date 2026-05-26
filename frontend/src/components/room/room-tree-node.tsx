import { useState, useRef, useEffect } from 'react';
import type { RoomNodeResponse } from '../../api/room-api';
import RoomStatusBadge from './room-status-badge';

interface Props {
  node: RoomNodeResponse;
  depth: number;
  expandedIds: string[];
  selectedId: string | null;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export default function RoomTreeNode({
  node, depth, expandedIds, selectedId,
  onToggleExpand, onSelect, onRename, onAddChild, onDelete, onDuplicate,
}: Props) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.includes(node.id);
  const isSelected = selectedId === node.id;
  const isLeaf = !hasChildren;

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [showMenu, setShowMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDoubleClick = () => {
    if (isLeaf) {
      setEditName(node.name);
      setIsEditing(true);
    }
  };

  const handleRenameSubmit = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== node.name) {
      onRename(node.id, trimmed);
    }
    setIsEditing(false);
  };

  const icon = depth === 0 ? (
    <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ) : isLeaf ? (
    <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ) : (
    <svg className="h-4 w-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );

  return (
    <div>
      <div
        className={[
          'group flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer text-sm transition-colors',
          isSelected ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100' : 'text-slate-700 hover:bg-slate-50',
        ].join(' ')}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        {/* Expand chevron */}
        <button
          type="button"
          className={[
            'flex-shrink-0 h-4 w-4 flex items-center justify-center rounded transition-colors',
            hasChildren ? 'text-slate-400 hover:text-slate-600' : 'invisible',
          ].join(' ')}
          onClick={(e) => { e.stopPropagation(); hasChildren && onToggleExpand(node.id); }}
        >
          <svg className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {icon}

        {/* Name */}
        {isEditing ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') setIsEditing(false); }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 rounded border border-indigo-300 px-1 py-0.5 text-sm outline-none focus:ring-1 focus:ring-indigo-400"
          />
        ) : (
          <span className="flex-1 truncate font-medium" onDoubleClick={handleDoubleClick}>
            {node.name}
            {node.code ? <span className="ml-1.5 text-xs text-slate-400">{node.code}</span> : null}
          </span>
        )}

        {/* Device count badge */}
        {isLeaf && node.deviceCount > 0 && (
          <span className="flex-shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            {node.deviceCount}
          </span>
        )}

        {/* Status badge */}
        {isLeaf && <RoomStatusBadge status={node.status} />}

        {/* Context menu button */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded text-slate-300 opacity-0 group-hover:opacity-100 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
            </svg>
          </button>
          {showMenu && (
            <div className="absolute left-0 top-full mt-1 z-50 w-44 rounded-xl border border-slate-200 bg-white shadow-lg py-1 text-sm">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                onClick={(e) => { e.stopPropagation(); setShowMenu(false); onAddChild(node.id); }}
              >
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Thêm phòng con
              </button>
              {isLeaf && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); onDuplicate(node.id); }}
                >
                  <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                  Nhân bản phòng
                </button>
              )}
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2"
                onClick={(e) => { e.stopPropagation(); setShowMenu(false); onDelete(node.id); }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Xóa
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <RoomTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
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
      )}
    </div>
  );
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getRoomTree, type RoomTreeNode, type RoomNodeSummary, getRoomDetail, createRoom, updateRoom, deleteRoom } from '../api/room-api';
import { type Device } from '../api/device-api';
import { getRoomDevices, duplicateRoom } from '../api/room-device-api';
import { useCan } from '../hooks/use-permission';
import DeviceStatusBadge from '../components/device/device-status-badge';

/** Collect all ancestor IDs for a given node ID in the tree */
function findAncestorIds(nodes: RoomTreeNode[], targetId: string): Set<string> {
  const ids = new Set<string>();
  function walk(node: RoomTreeNode, path: string[]): boolean {
    if (node.id === targetId) { path.forEach(id => ids.add(id)); return true; }
    for (const child of node.children) {
      if (walk(child, [...path, node.id])) return true;
    }
    return false;
  }
  nodes.forEach(n => walk(n, []));
  return ids;
}

/** Recursively filter tree by search query, returning filtered nodes and ancestor IDs to expand */
function filterTree(nodes: RoomTreeNode[], query: string): { filtered: RoomTreeNode[]; expandIds: Set<string> } {
  const q = query.toLowerCase();
  const expandIds = new Set<string>();
  function recurse(node: RoomTreeNode): RoomTreeNode | null {
    const childResults = node.children.map(c => recurse(c)).filter((c): c is RoomTreeNode => c !== null);
    const nameMatch = node.name.toLowerCase().includes(q);
    if (nameMatch || childResults.length > 0) {
      if (childResults.length > 0) expandIds.add(node.id);
      return { ...node, children: nameMatch ? node.children : childResults };
    }
    return null;
  }
  const filtered = nodes.map(n => recurse(n)).filter((n): n is RoomTreeNode => n !== null);
  return { filtered, expandIds };
}

export default function RoomTreePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [tree, setTree] = useState<RoomTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RoomNodeSummary | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

  const canCreate = useCan('rooms', 'create');
  const canUpdate = useCan('rooms', 'update');
  const canDelete = useCan('rooms', 'delete');

  // Form state
  const [showForm, setShowForm] = useState<'create' | 'edit' | 'duplicate' | null>(null);
  const [formName, setFormName] = useState('');
  const [formParentId, setFormParentId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  // Duplicate state
  const [dupPrefix, setDupPrefix] = useState('');
  const [dupStart, setDupStart] = useState(1);
  const [dupEnd, setDupEnd] = useState(1);
  const [dupResult, setDupResult] = useState<{ rooms_created: number; devices_cloned: number } | null>(null);
  const [dupMode, setDupMode] = useState<'range' | 'list'>('range');
  const [dupList, setDupList] = useState('');

  const fetchTree = useCallback(async () => {
    try { setError(null); setTree(await getRoomTree()); } catch (e: unknown) { setError((e as Error).message || 'Failed to load rooms'); } finally { setLoading(false); }
  }, []);

  const fetchDetail = useCallback(async (id: string) => {
    try {
      const detail = await getRoomDetail(id);
      setSelected(detail);
      navigate(`/rooms/${id}`, { replace: true });
      setDevicesLoading(true);
      try { setSelectedDevices(await getRoomDevices(id)); } catch { setSelectedDevices([]); } finally { setDevicesLoading(false); }
    } catch { setSelected(null); }
  }, [navigate]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  // Auto-select room from URL param and expand its ancestors
  useEffect(() => {
    if (roomId && tree.length > 0) {
      fetchDetail(roomId);
      const ancestors = findAncestorIds(tree, roomId);
      if (ancestors.size > 0) {
        setExpandedIds(prev => { const next = new Set(prev); ancestors.forEach(id => next.add(id)); return next; });
      }
    }
  }, [roomId, tree.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleExpand(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setExpandedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  // Compute the display tree based on search
  const { displayTree, searchExpandIds } = useMemo(() => {
    if (!searchQuery.trim()) return { displayTree: tree, searchExpandIds: new Set<string>() };
    const { filtered, expandIds } = filterTree(tree, searchQuery.trim());
    return { displayTree: filtered, searchExpandIds: expandIds };
  }, [tree, searchQuery]);

  function openCreate(parentId?: string | null) {
    setShowForm('create'); setFormName(''); setFormParentId(parentId !== undefined ? parentId : null); setFormError(null); setDupResult(null);
  }
  function openEdit() { if (!selected) return; setShowForm('edit'); setFormName(selected.name); setFormParentId(selected.parent_id); setFormError(null); setDupResult(null); }
  function openDuplicate() { if (!selected) return; setShowForm('duplicate'); setDupPrefix(''); setDupStart(1); setDupEnd(1); setDupMode('range'); setDupList(''); setFormError(null); setDupResult(null); }

  async function handleSave() {
    if (!formName.trim()) { setFormError('Tên phòng là bắt buộc'); return; }
    setSaving(true); setFormError(null);
    try {
      if (showForm === 'create') { await createRoom({ name: formName.trim(), parent_id: formParentId || null }); }
      else if (showForm === 'edit' && selected) { await updateRoom(selected.id, { name: formName.trim(), parent_id: formParentId ?? null }); await fetchDetail(selected.id); }
      setShowForm(null); await fetchTree();
    } catch (e: unknown) { setFormError((e as { response?: { data?: { error?: string } } }).response?.data?.error || (e as Error).message); } finally { setSaving(false); }
  }

  async function handleDuplicate() {
    if (!selected) return;
    setSaving(true); setFormError(null); setDupResult(null);
    try {
      const payload: Parameters<typeof duplicateRoom>[1] = { prefix: dupPrefix.trim() || undefined, mode: dupMode };
      if (dupMode === 'list') {
        payload.list = dupList;
      } else {
        payload.start = dupStart;
        payload.end = dupEnd;
      }
      const result = await duplicateRoom(selected.id, payload);
      setDupResult(result);
      await fetchTree();
    } catch (e: unknown) { setFormError((e as { response?: { data?: { error?: string } } }).response?.data?.error || (e as Error).message); } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    try {
      await deleteRoom(id); setDeleteConfirm(null);
      if (selected?.id === id) { setSelected(null); setSelectedDevices([]); navigate('/rooms', { replace: true }); }
      await fetchTree();
    } catch (e: unknown) { alert((e as { response?: { data?: { error?: string } } }).response?.data?.error || (e as Error).message); }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-200 border-t-indigo-600" />
        <p className="text-sm text-slate-400">Đang tải sơ đồ phòng...</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6" style={{ minHeight: 'calc(100vh - 10rem)' }}>
      {/* ── Tree Panel ─────────────────────────────────────── */}
      <div className={`w-full lg:w-80 xl:w-96 shrink-0 panel flex-col overflow-hidden ${selected ? 'hidden lg:flex' : 'flex'}`}>
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h2 className="text-sm font-bold text-slate-700">Sơ đồ phòng</h2>
          </div>
          {canCreate && (
            <button
              onClick={() => openCreate(null)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Thêm
            </button>
          )}
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-slate-50">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-7 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all"
              placeholder="Tìm phòng..."
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {error && <p className="text-red-500 text-sm px-2 py-3">{error}</p>}
          {displayTree.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-14 text-slate-400">
              {searchQuery.trim() ? (
                <>
                  <svg className="h-10 w-10 mb-2 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <p className="text-sm">Không tìm thấy phòng</p>
                </>
              ) : (
                <>
                  <svg className="h-10 w-10 mb-2 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  <p className="text-sm">Chưa có phòng nào</p>
                </>
              )}
            </div>
          )}
          {displayTree.map(node => (
            <RoomTreeItem key={node.id} node={node} selectedId={selected?.id} onSelect={id => fetchDetail(id)} depth={0} expandedIds={expandedIds} onToggleExpand={toggleExpand} searchExpandIds={searchExpandIds} />
          ))}
        </div>
      </div>

      {/* ── Detail Panel ────────────────────────────────────── */}
      <div className={`flex-1 min-w-0 panel p-5 md:p-6 overflow-y-auto ${!selected ? 'hidden lg:flex lg:items-center lg:justify-center' : 'block'}`}>
        {selected ? (
          <div className="animate-fade-in">
            {/* Back button (mobile only) */}
            <button
              onClick={() => { setSelected(null); navigate('/rooms', { replace: true }); }}
              className="lg:hidden mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Quay lại sơ đồ
            </button>

            {/* Room header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 pb-5 border-b border-slate-100">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-0.5">Chi tiết phòng</p>
                <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                  {selected.name}
                  {selected.status === 'needs_maintenance' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Cần bảo trì
                    </span>
                  )}
                </h2>
                <p className="text-sm text-slate-500 mt-1">{selected.breadcrumb}</p>
              </div>

              <div className="flex flex-wrap gap-2 shrink-0">
                {canUpdate && (
                  <button onClick={openEdit} className="btn btn-ghost text-xs px-3 py-2">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Sửa
                  </button>
                )}
                {canCreate && selected.is_leaf && selected.parent_id && (
                  <button onClick={openDuplicate} className="btn btn-ghost text-xs px-3 py-2">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Nhân bản
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => setDeleteConfirm(selected.id)} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Xóa
                  </button>
                )}
              </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              <InfoCard
                icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg>}
                label="Thiết bị trong phòng"
                value={String(selected.device_count)}
              />
              <InfoCard
                icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>}
                label="Tổng thiết bị (bao gồm con)"
                value={String(selected.descendant_device_count)}
              />
              <InfoCard
                icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                label="Tình trạng"
                value={selected.status === 'needs_maintenance' ? 'Cần bảo trì' : 'Bình thường'}
                highlight={selected.status === 'needs_maintenance'}
              />
            </div>

            {/* Device list */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                <h3 className="text-sm font-bold text-slate-700">Thiết bị trong phòng này</h3>
                {selected.is_leaf && (
                  <Link
                    to={`/rooms/${selected.id}/devices/new`}
                    className="btn btn-primary text-xs px-3 py-2"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Thêm thiết bị
                  </Link>
                )}
              </div>
              {!selected.is_leaf && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-500 mb-4">
                  <svg className="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Phòng này có phòng con — chỉ có thể thêm thiết bị vào phòng cuối (lá).
                </div>
              )}
              {devicesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
                  ))}
                </div>
              ) : selectedDevices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <svg className="h-10 w-10 mb-2 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg>
                  <p className="text-sm">Chưa có thiết bị nào.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDevices.map(d => (
                    <Link
                      key={d.id}
                      to={`/rooms/${selected.id}/devices/${d.id}`}
                      className="group flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 bg-white hover:border-indigo-100 hover:bg-indigo-50/40 transition-all duration-150"
                    >
                      <div className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg shrink-0">
                        {d.store_id}
                      </div>
                      <span className="text-sm font-semibold text-slate-700 flex-1 truncate group-hover:text-indigo-700 transition-colors">
                        {d.name}
                      </span>
                      {d.maintenance_status === 'needs_maintenance' && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Cần bảo trì" />
                      )}
                      <DeviceStatusBadge status={d.status} />
                      <svg className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400">
            <svg className="h-16 w-16 mb-4 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            <p className="text-base font-semibold text-slate-400 mb-1">Chọn một phòng để xem chi tiết</p>
            <p className="text-sm text-slate-300">Nhấn vào bất kỳ phòng nào trong sơ đồ bên trái</p>
          </div>
        )}
      </div>

      {/* ── Create/Edit Modal ───────────────────────────────── */}
      {showForm && showForm !== 'duplicate' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowForm(null)}>
          <div className="panel p-6 w-full max-w-md animate-scale-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-slate-800 mb-4">{showForm === 'create' ? 'Thêm phòng mới' : 'Sửa phòng'}</h3>
            {formError && <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">{formError}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tên phòng</label>
                <input value={formName} onChange={e => setFormName(e.target.value)} className="form-input" placeholder="Nhập tên phòng" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Phòng cha</label>
                <select value={formParentId || ''} onChange={e => setFormParentId(e.target.value || null)} className="form-select">
                  <option value="">(Không có — phòng gốc)</option>
                  {tree.flatMap(n => {
                    const options: { id: string; label: string }[] = [];
                    function collect(inner: RoomTreeNode, depth: number) {
                      if (inner.id !== selected?.id) options.push({ id: inner.id, label: '  '.repeat(depth) + inner.name });
                      inner.children.forEach(c => collect(c, depth + 1));
                    }
                    collect(n, 0); return options;
                  }).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowForm(null)} className="btn btn-ghost text-sm">Hủy</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary text-sm">{saving ? 'Đang lưu...' : (showForm === 'create' ? 'Tạo phòng' : 'Lưu thay đổi')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Duplicate Modal ─────────────────────────────────── */}
      {showForm === 'duplicate' && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowForm(null)}>
          <div className="panel p-6 w-full max-w-md animate-scale-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-slate-800 mb-1">Nhân bản phòng</h3>
            <p className="text-sm text-slate-500 mb-4">Nhân bản "{selected.name}" và các phòng con, thiết bị trực thuộc.</p>
            {formError && <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">{formError}</div>}
            {dupResult && <div className="mb-3 p-3 rounded-xl bg-green-50 border border-green-100 text-sm text-green-700">Đã tạo {dupResult.rooms_created} phòng, {dupResult.devices_cloned} thiết bị.</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tiền tố (tùy chọn)</label>
                <input value={dupPrefix} onChange={e => setDupPrefix(e.target.value)} className="form-input" placeholder="Ví dụ: P. Server" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Chế độ</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setDupMode('range')} className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold border transition-colors ${dupMode === 'range' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>Khoảng số</button>
                  <button type="button" onClick={() => setDupMode('list')} className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold border transition-colors ${dupMode === 'list' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>Danh sách</button>
                </div>
              </div>
              {dupMode === 'range' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Bắt đầu</label>
                      <input type="number" min={1} max={50} value={dupStart} onChange={e => setDupStart(Number(e.target.value) || 1)} className="form-input" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Kết thúc</label>
                      <input type="number" min={1} max={50} value={dupEnd} onChange={e => setDupEnd(Number(e.target.value) || 1)} className="form-input" />
                    </div>
                  </div>
                  {dupStart <= dupEnd && dupEnd <= 50 && dupPrefix.trim() && (
                    <div className="bg-indigo-50/60 rounded-xl p-3 text-xs text-indigo-700 border border-indigo-100">
                      <span className="font-bold">Xem trước: </span>
                      {Array.from({ length: dupEnd - dupStart + 1 }, (_, i) => dupStart + i).map(n => {
                        const suffix = n.toString().padStart(String(dupEnd).length, '0');
                        return `${dupPrefix.trim()} ${suffix}${n < dupEnd ? ', ' : ''}`;
                      })}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Danh sách (cách nhau bằng dấu phẩy)</label>
                    <input value={dupList} onChange={e => setDupList(e.target.value)} className="form-input" placeholder="A, B, C, D" />
                  </div>
                  {dupList.trim() && dupPrefix.trim() && (
                    <div className="bg-indigo-50/60 rounded-xl p-3 text-xs text-indigo-700 border border-indigo-100">
                      <span className="font-bold">Xem trước: </span>
                      {dupList.split(',').map(s => s.trim()).filter(s => s).map((s, i, arr) =>
                        `${dupPrefix.trim()} ${s}${i < arr.length - 1 ? ', ' : ''}`
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowForm(null)} className="btn btn-ghost text-sm">Hủy</button>
              <button onClick={handleDuplicate} disabled={saving} className="btn btn-primary text-sm">{saving ? 'Đang nhân bản...' : 'Nhân bản'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setDeleteConfirm(null)}>
          <div className="panel p-6 w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h3 className="text-lg font-extrabold text-slate-800 mb-2">Xác nhận xóa</h3>
            <p className="text-sm text-slate-600 mb-5">Bạn có chắc muốn xóa phòng này? Phòng có chứa phòng con hoặc thiết bị sẽ không thể xóa.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="btn btn-ghost text-sm">Hủy</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn btn-danger text-sm">Xóa phòng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 border ${highlight ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
      <div className={`mb-2 ${highlight ? 'text-amber-500' : 'text-slate-400'}`}>{icon}</div>
      <p className="text-xs font-medium text-slate-500 mb-0.5">{label}</p>
      <p className={`text-lg font-extrabold ${highlight ? 'text-amber-700' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}

function RoomTreeItem({ node, selectedId, onSelect, depth, expandedIds, onToggleExpand, searchExpandIds }: {
  node: RoomTreeNode;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  depth: number;
  expandedIds: Set<string>;
  onToggleExpand: (id: string, e: React.MouseEvent) => void;
  searchExpandIds: Set<string>;
}) {
  const isSelected = selectedId === node.id;
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id) || searchExpandIds.has(node.id);
  const needsMaintenance = node.status === 'needs_maintenance';

  return (
    <div>
      <button
        onClick={() => onSelect(node.id)}
        className={`tree-row w-full ${isSelected ? 'active' : ''}`}
        style={{ paddingLeft: `${10 + depth * 16}px` }}
      >
        {/* Chevron */}
        {hasChildren ? (
          <span
            onClick={e => onToggleExpand(node.id, e)}
            className="inline-flex items-center justify-center h-5 w-5 shrink-0 rounded hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            <svg
              className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {/* Room icon */}
        <svg
          className={`h-4 w-4 shrink-0 ${isSelected ? 'text-indigo-500' : needsMaintenance ? 'text-amber-400' : 'text-slate-400'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>

        <span className="truncate flex-1 text-left">{node.name}</span>

        {/* Maintenance dot — shown on BOTH parent and child */}
        {needsMaintenance && (
          <span
            className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse"
            title="Có thiết bị cần bảo trì"
          />
        )}

        {node.descendant_device_count > 0 && (
          <span className={`text-[10px] font-semibold shrink-0 tabular-nums ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`}>
            {node.descendant_device_count}
          </span>
        )}
      </button>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <RoomTreeItem
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              searchExpandIds={searchExpandIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}

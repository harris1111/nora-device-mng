import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getRoomTree, type RoomTreeNode, type RoomNodeSummary, getRoomDetail, createRoom, updateRoom, deleteRoom } from '../api/room-api';
import { getLocations, type Location, type Device, getDevices } from '../api/device-api';
import { getRoomDevices, duplicateRoom } from '../api/room-device-api';
import { useCan } from '../hooks/use-permission';
import DeviceStatusBadge from '../components/device/device-status-badge';

export default function RoomTreePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [tree, setTree] = useState<RoomTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RoomNodeSummary | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const canCreate = useCan('rooms', 'create');
  const canUpdate = useCan('rooms', 'update');
  const canDelete = useCan('rooms', 'delete');

  // Form state
  const [showForm, setShowForm] = useState<'create' | 'edit' | 'duplicate' | null>(null);
  const [formName, setFormName] = useState('');
  const [formLocationId, setFormLocationId] = useState('');
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
    getLocations().then(setLocations).catch(() => {});
  }, [fetchTree]);

  // Auto-select room from URL param
  useEffect(() => {
    if (roomId && tree.length > 0) {
      fetchDetail(roomId);
    }
  }, [roomId, tree.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function openCreate(parentId?: string | null) {
    setShowForm('create'); setFormName(''); setFormLocationId(selected?.location_id || locations[0]?.id || ''); setFormParentId(parentId !== undefined ? parentId : null); setFormError(null); setDupResult(null);
  }
  function openEdit() { if (!selected) return; setShowForm('edit'); setFormName(selected.name); setFormLocationId(selected.location_id); setFormParentId(selected.parent_id); setFormError(null); setDupResult(null); }
  function openDuplicate() { if (!selected) return; setShowForm('duplicate'); setDupPrefix(''); setDupStart(1); setDupEnd(1); setDupMode('range'); setDupList(''); setFormError(null); setDupResult(null); }

  async function handleSave() {
    if (!formName.trim()) { setFormError('Tên phòng là bắt buộc'); return; }
    if (showForm === 'create' && !formLocationId) { setFormError('Đơn vị là bắt buộc'); return; }
    setSaving(true); setFormError(null);
    try {
      if (showForm === 'create') { await createRoom({ name: formName.trim(), location_id: formLocationId, parent_id: formParentId || null }); }
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

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;

  return (
    <div className="flex gap-6 h-[calc(100vh-12rem)]">
      {/* Tree Panel */}
      <div className="w-80 shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700">Sơ đồ phòng</h3>
          {canCreate && locations.length > 0 && (
            <button onClick={() => openCreate(null)} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Thêm
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {error && <p className="text-red-500 text-sm p-2">{error}</p>}
          {tree.length === 0 && !error && (
            <div className="text-center py-8 text-slate-400 text-sm">
              <svg className="mx-auto h-10 w-10 mb-2 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              Chưa có phòng nào
            </div>
          )}
          {tree.map(node => (
            <RoomTreeItem key={node.id} node={node} selectedId={selected?.id} onSelect={id => fetchDetail(id)} depth={0} />
          ))}
        </div>
      </div>

      {/* Detail Panel */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-y-auto">
        {selected ? (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{selected.name}</h2>
                <p className="text-sm text-slate-500">{selected.breadcrumb}</p>
              </div>
              <div className="flex gap-2">
                {canUpdate && <button onClick={openEdit} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>Sửa</button>}
                {canCreate && selected.is_leaf && selected.parent_id && <button onClick={openDuplicate} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Nhân bản</button>}
                {canDelete && <button onClick={() => setDeleteConfirm(selected.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Xóa</button>}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <InfoCard label="Đơn vị" value={selected.location_name} />
              <InfoCard label="Số thiết bị trực tiếp" value={String(selected.device_count)} />
              <InfoCard label="Tổng thiết bị" value={String(selected.descendant_device_count)} />
              <InfoCard label="Trạng thái" value={selected.status === 'needs_maintenance' ? 'Cần bảo trì' : 'Bình thường'} highlight={selected.status === 'needs_maintenance'} />
              <InfoCard label="Có phòng con" value={selected.has_children ? 'Có' : 'Không'} />
              <InfoCard label="Là phòng lá" value={selected.is_leaf ? 'Có' : 'Không'} />
            </div>

            {/* Device list */}
            <div className="border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-700">Thiết bị trong phòng</h3>
                {selected.is_leaf && (
                  <Link to={`/rooms/${selected.id}/devices/new`} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Thêm thiết bị
                  </Link>
                )}
              </div>
              {!selected.is_leaf && <p className="text-sm text-slate-400 mb-3">Phòng này có phòng con — không thể thêm thiết bị trực tiếp.</p>}
              {devicesLoading ? <p className="text-sm text-slate-400">Đang tải...</p> :
                selectedDevices.length === 0 ? <p className="text-sm text-slate-400">Chưa có thiết bị nào.</p> :
                <div className="space-y-2">
                  {selectedDevices.map(d => (
                    <Link key={d.id} to={`/rooms/${selected.id}/devices/${d.id}`} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                      <div className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{d.store_id}</div>
                      <span className="text-sm font-medium text-slate-700 flex-1 truncate">{d.name}</span>
                      <DeviceStatusBadge status={d.status} />
                      <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  ))}
                </div>
              }
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              Chọn một phòng để xem chi tiết
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && showForm !== 'duplicate' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowForm(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-4">{showForm === 'create' ? 'Thêm phòng mới' : 'Sửa phòng'}</h3>
            {formError && <p className="text-red-500 text-sm mb-3">{formError}</p>}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Tên phòng</label>
                <input value={formName} onChange={e => setFormName(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Nhập tên phòng" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Phòng cha</label>
                <select value={formParentId || ''} onChange={e => setFormParentId(e.target.value || null)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
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
              <button onClick={() => setShowForm(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Hủy</button>
              <button onClick={handleSave} disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Đang lưu...' : (showForm === 'create' ? 'Tạo' : 'Lưu')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Modal */}
      {showForm === 'duplicate' && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowForm(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Nhân bản phòng</h3>
            <p className="text-sm text-slate-500 mb-4">Nhân bản "{selected.name}" và các phòng con, thiết bị trực thuộc.</p>
            {formError && <p className="text-red-500 text-sm mb-3">{formError}</p>}
            {dupResult && <p className="text-green-600 text-sm mb-3">Đã tạo {dupResult.rooms_created} phòng, {dupResult.devices_cloned} thiết bị.</p>}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Tiền tố (tùy chọn)</label>
                <input value={dupPrefix} onChange={e => setDupPrefix(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Ví dụ: P. Server" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Chế độ</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setDupMode('range')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${dupMode === 'range' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>Khoảng số</button>
                  <button type="button" onClick={() => setDupMode('list')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${dupMode === 'list' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>Danh sách</button>
                </div>
              </div>
              {dupMode === 'range' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Bắt đầu</label>
                      <input type="number" min={1} max={50} value={dupStart} onChange={e => setDupStart(Number(e.target.value) || 1)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Kết thúc</label>
                      <input type="number" min={1} max={50} value={dupEnd} onChange={e => setDupEnd(Number(e.target.value) || 1)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    </div>
                  </div>
                  {dupStart <= dupEnd && dupEnd <= 50 && dupPrefix.trim() && (
                    <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
                      <span className="font-semibold">Xem trước:</span>{' '}
                      {Array.from({ length: dupEnd - dupStart + 1 }, (_, i) => dupStart + i).map(n => {
                        const suffix = n.toString().padStart(String(dupEnd).length, '0');
                        return `${dupPrefix.trim()} ${suffix} - ${selected.name}${n < dupEnd ? ', ' : ''}`;
                      })}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Danh sách (cách nhau bằng dấu phẩy)</label>
                    <input value={dupList} onChange={e => setDupList(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="A, B, C, D" />
                  </div>
                  {dupList.trim() && dupPrefix.trim() && (
                    <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
                      <span className="font-semibold">Xem trước:</span>{' '}
                      {dupList.split(',').map(s => s.trim()).filter(s => s).map((s, i, arr) =>
                        `${dupPrefix.trim()} ${s} - ${selected.name}${i < arr.length - 1 ? ', ' : ''}`
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowForm(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Hủy</button>
              <button onClick={handleDuplicate} disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Đang nhân bản...' : 'Nhân bản'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Xác nhận xóa</h3>
            <p className="text-sm text-slate-600 mb-4">Bạn có chắc muốn xóa phòng này? Phòng có chứa phòng con hoặc thiết bị sẽ không thể xóa.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Hủy</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-amber-600' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}

function RoomTreeItem({ node, selectedId, onSelect, depth }: { node: RoomTreeNode; selectedId: string | undefined; onSelect: (id: string) => void; depth: number }) {
  const isSelected = selectedId === node.id;
  return (
    <div>
      <button
        onClick={() => onSelect(node.id)}
        className={`w-full text-left flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${isSelected ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100' : 'text-slate-700 hover:bg-slate-50'}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <svg className={`h-4 w-4 shrink-0 ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <span className="truncate flex-1">{node.name}</span>
        {node.status === 'needs_maintenance' && <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Cần bảo trì" />}
        {node.descendant_device_count > 0 && <span className="text-xs text-slate-400 shrink-0">{node.descendant_device_count}</span>}
        {node.has_children && <svg className="h-3 w-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
      </button>
      {node.children.length > 0 && (
        <div>{node.children.map(child => <RoomTreeItem key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />)}</div>
      )}
    </div>
  );
}

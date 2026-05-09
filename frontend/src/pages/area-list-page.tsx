import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAreas, createArea, updateAreaApi, deleteAreaApi, Area } from '../api/device-api';
import EmptyState from '../components/ui/empty-state';
import ErrorState from '../components/ui/error-state';

export default function AreaListPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New area form
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  // Inline edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchAreas = () => {
    getAreas()
      .then(setAreas)
      .catch(() => setError('Không thể tải danh sách khu vực'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAreas(); }, []);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createArea({ name: newName.trim() });
      setNewName('');
      fetchAreas();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Không thể tạo khu vực');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateAreaApi(id, { name: editName.trim() });
      setEditId(null);
      fetchAreas();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Không thể cập nhật khu vực');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Xóa khu vực "${name}"?`)) return;
    setError(null);
    try {
      await deleteAreaApi(id);
      fetchAreas();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Không thể xóa khu vực');
    }
  };

  return (
    <div className="max-w-4xl pb-12">
      {/* Desktop Hidden Header */}
      <div className="mb-8 flex justify-between items-center hidden md:flex">
         <Link to="/devices" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">
            <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Quay lại Thiết bị
         </Link>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorState message={error} />
        </div>
      )}

      {/* Add area form */}
      <div className="card-glass p-6 mb-8 border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Thêm Khu vực
        </h2>
        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ví dụ: Khu A, Tầng 2, Khu kho..."
            className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm"
            required
          />
          <button
            type="submit"
            disabled={creating}
            className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap transition-all active:scale-95"
          >
            {creating ? 'Đang thêm...' : 'Tạo mới'}
          </button>
        </form>
      </div>

      <div className="card-glass border border-slate-100 overflow-hidden">
        {loading ? (
           <div className="p-8 space-y-4 animate-pulse">
             <div className="h-4 bg-slate-200 rounded w-full"></div>
             <div className="h-4 bg-slate-200 rounded w-full"></div>
             <div className="h-4 bg-slate-200 rounded w-full"></div>
           </div>
        ) : areas.length === 0 ? (
          <EmptyState
            variant="subtle"
            icon={
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            }
            title="Chưa có khu vực nào"
            description="Thêm khu vực đầu tiên ở biểu mẫu bên trên."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Tên khu vực</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest hidden sm:table-cell">Ngày tạo</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {areas.map((area) => (
                  <tr key={area.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      {editId === area.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdate(area.id);
                            if (e.key === 'Escape') setEditId(null);
                          }}
                        />
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                          </div>
                          <span className="font-bold text-slate-800">{area.name}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 font-medium hidden sm:table-cell">
                      {new Date(area.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {editId === area.id ? (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleUpdate(area.id)}
                            disabled={saving}
                            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                            title="Lưu"
                          >
                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                            title="Hủy"
                          >
                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2 justify-end opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={() => { setEditId(area.id); setEditName(area.name); }}
                            className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Sửa"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button
                            onClick={() => handleDelete(area.id, area.name)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Xóa"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

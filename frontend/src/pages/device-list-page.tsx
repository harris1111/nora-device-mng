import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getDevices, Device, bulkDeleteDevices } from '../api/device-api';
import { useCan } from '../hooks/use-permission';
import DeviceCard from '../components/device/device-card';
import DeviceListRow from '../components/device/device-list-row';
import ViewToggle from '../components/ui/view-toggle';
import DeviceFilterBar, { useDeviceFilter, EMPTY_FILTERS, type DeviceFilters } from '../components/device-filter-bar';
import BulkEditModal from '../components/bulk-edit-modal';

export default function DeviceListPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState(() => localStorage.getItem('deviceView') || 'grid');
  const [filters, setFilters] = useState<DeviceFilters>({ ...EMPTY_FILTERS });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);

  const canUpdate = useCan('devices', 'update');
  const canDelete = useCan('devices', 'delete');

  const fetchDevices = useCallback(() => {
    setLoading(true);
    getDevices()
      .then(d => { setDevices(d); setSelectedIds(new Set()); })
      .catch(() => setError('Không thể tải danh sách thiết bị'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const handleViewChange = (newView: string) => {
    setView(newView);
    localStorage.setItem('deviceView', newView);
  };

  const filteredDevices = useDeviceFilter(devices, filters);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev =>
      prev.size === filteredDevices.length
        ? new Set()
        : new Set(filteredDevices.map(d => d.id))
    );
  }, [filteredDevices]);

  const selectedDevices = filteredDevices.filter(d => selectedIds.has(d.id));

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Xóa ${selectedIds.size} thiết bị đã chọn? Thao tác này không thể hoàn tác.`)) return;
    try {
      await bulkDeleteDevices([...selectedIds]);
      fetchDevices();
    } catch {
      setError('Không thể xóa thiết bị');
    }
  };

  const hasBulkActions = canUpdate || canDelete;

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <DeviceFilterBar
        filters={filters}
        onChange={setFilters}
        trailing={<ViewToggle view={view} onChange={handleViewChange} />}
      />

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && hasBulkActions && (
        <div className="flex items-center gap-3 px-5 py-3 bg-indigo-50 border border-indigo-100 rounded-2xl shadow-sm animate-slide-up">
          <span className="text-sm font-semibold text-indigo-700">
            Đã chọn {selectedIds.size} thiết bị
          </span>
          <div className="flex-1" />
          {canUpdate && (
            <button
              onClick={() => setShowBulkEdit(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Sửa hàng loạt
            </button>
          )}
          {canDelete && (
            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Xóa hàng loạt
            </button>
          )}
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Bỏ chọn
          </button>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEdit && (
        <BulkEditModal
          devices={selectedDevices}
          onClose={() => setShowBulkEdit(false)}
          onSuccess={() => { setShowBulkEdit(false); fetchDevices(); }}
        />
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
             <div key={i} className="h-64 bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-4 animate-pulse">
               <div className="w-full h-32 bg-slate-200 rounded-xl"></div>
               <div className="h-4 bg-slate-200 rounded w-3/4"></div>
               <div className="h-4 bg-slate-200 rounded w-1/2"></div>
             </div>
          ))}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm font-medium flex items-center gap-2">
           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {error}
        </div>
      )}

      {!loading && !error && filteredDevices.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 border-dashed shadow-sm flex flex-col items-center">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500 mb-4">
             <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
             </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-800">Chưa có thiết bị nào</h3>
          <p className="mt-2 text-slate-500 text-sm max-w-sm mx-auto">Nhấn nút thêm ở góc phải (hoặc bên dưới) để bắt đầu tạo thiết bị quản lý đầu tiên.</p>
        </div>
      )}

      {/* Grid View */}
      {!loading && filteredDevices.length > 0 && view === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredDevices.map((device, index) => (
            <div key={device.id} className="relative animate-slide-up" style={{ animationDelay: `${Math.min(index * 50, 500)}ms`, animationFillMode: 'both' }}>
              {hasBulkActions && (
                <div className="absolute top-3 left-3 z-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(device.id)}
                    onChange={() => toggleSelect(device.id)}
                    className="w-5 h-5 rounded-md border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shadow-sm bg-white/90"
                  />
                </div>
              )}
               <DeviceCard device={device} />
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {!loading && filteredDevices.length > 0 && view === 'list' && (
        <div className="card-glass bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-slate-50/50">
              <tr>
                {hasBulkActions && (
                  <th className="w-12 px-4 py-4 border-b border-slate-100">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredDevices.length && filteredDevices.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">Hình ảnh</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">Mã thiết bị</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">Tên thiết bị</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">Loại thiết bị</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">Trạng thái</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">Đơn vị trực thuộc</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">Chuyển giao</th>
                <th className="px-6 py-4 border-b border-slate-100"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredDevices.map((device) => (
                 <DeviceListRow
                   key={device.id}
                   device={device}
                   selectable={hasBulkActions}
                   selected={selectedIds.has(device.id)}
                   onToggleSelect={() => toggleSelect(device.id)}
                 />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { getDevices, exportDevicesExcel, Device } from '../api/device-api';
import { getStatusInfo, getTypeName } from '../components/device-constants';
import { useCan } from '../hooks/use-permission';
import DeviceFilterBar, { useDeviceFilter, EMPTY_FILTERS, type DeviceFilters } from '../components/device-filter-bar';

export default function ExcelExportPage() {
  const canExport = useCan('devices', 'export');
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<DeviceFilters>({ ...EMPTY_FILTERS });

  useEffect(() => {
    getDevices()
      .then(setDevices)
      .catch(() => setError('Không thể tải danh sách thiết bị'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useDeviceFilter(devices, filters);

  const allFilteredSelected = filtered.length > 0 && filtered.every(d => selected.has(d.id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selected);
      filtered.forEach(d => next.delete(d.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach(d => next.add(d.id));
      setSelected(next);
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleExport = async () => {
    if (selected.size === 0) return;
    setExporting(true);
    setError(null);
    try {
      const blob = await exportDevicesExcel(Array.from(selected));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `thiet-bi-${timestamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('Xuất Excel thất bại. Vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
      </div>
    );
  }

  if (!canExport) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <svg className="w-12 h-12 mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" /></svg>
        <p className="text-lg font-medium">Bạn không có quyền xuất Excel</p>
        <p className="text-sm mt-1">Liên hệ quản trị viên để được cấp quyền.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <DeviceFilterBar filters={filters} onChange={setFilters} />

      {/* Export Button Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-slate-100">
        <p className="text-sm text-slate-600">
          Đã chọn <span className="font-semibold text-indigo-600">{selected.size}</span> / {devices.length} thiết bị
        </p>
        <button
          onClick={handleExport}
          disabled={selected.size === 0 || exporting}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {exporting ? (
            <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          Xuất Excel
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm border border-red-100">{error}</div>
      )}

      {/* Device Table */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left w-12">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Mã thiết bị</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Tên thiết bị</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Loại</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Trạng thái</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Đơn vị</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Chuyển giao</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Ngày nhập</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    Không tìm thấy thiết bị nào.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => {
                  const statusInfo = getStatusInfo(d.status);
                  return (
                    <tr
                      key={d.id}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${selected.has(d.id) ? 'bg-indigo-50/50' : ''}`}
                      onClick={() => toggle(d.id)}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(d.id)}
                          onChange={() => toggle(d.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{d.store_id}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{d.name}</td>
                      <td className="px-4 py-3 text-slate-600">{getTypeName(d.type)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-${statusInfo.color}-100 text-${statusInfo.color}-700`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{d.location_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{d.owned_by ? [d.location_name, d.owned_by].filter(Boolean).join(' → ') : ''}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(d.created_at).toLocaleDateString('vi-VN')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

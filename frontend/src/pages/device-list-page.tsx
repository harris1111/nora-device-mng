import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getDevices,
  exportDevicesExcelFiltered,
  bulkDeleteDevices,
  getLocations,
  Device,
  DeviceListParams,
  Location,
} from '../api/device-api';
import { useCan } from '../hooks/use-permission';
import DeviceCard from '../components/device/device-card';
import DeviceListRow from '../components/device/device-list-row';
import ViewToggle from '../components/ui/view-toggle';
import Pagination from '../components/ui/pagination';
import EmptyState from '../components/ui/empty-state';
import ErrorState from '../components/ui/error-state';
import DeviceFilterBar, { type DeviceFilters } from '../components/device-filter-bar';
import BulkEditModal from '../components/bulk-edit-modal';

const DEFAULT_LIMIT = 20;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 100];
const SEARCH_DEBOUNCE_MS = 300;

// Read filters/pagination from URL — single source of truth for shareable state
function readStateFromParams(params: URLSearchParams): { filters: DeviceFilters; page: number; limit: number } {
  const limitRaw = parseInt(params.get('limit') || '', 10);
  const pageRaw = parseInt(params.get('page') || '', 10);
  return {
    filters: {
      search: params.get('search') || '',
      type: params.get('type') || '',
      status: params.get('status') || '',
      location: params.get('location') || '',
      dateFrom: params.get('date_from') || '',
      dateTo: params.get('date_to') || '',
    },
    page: pageRaw > 0 ? pageRaw : 1,
    limit: PAGE_SIZE_OPTIONS.includes(limitRaw) ? limitRaw : DEFAULT_LIMIT,
  };
}

function writeStateToParams(filters: DeviceFilters, page: number, limit: number): URLSearchParams {
  const next = new URLSearchParams();
  if (filters.search) next.set('search', filters.search);
  if (filters.type) next.set('type', filters.type);
  if (filters.status) next.set('status', filters.status);
  if (filters.location) next.set('location', filters.location);
  if (filters.dateFrom) next.set('date_from', filters.dateFrom);
  if (filters.dateTo) next.set('date_to', filters.dateTo);
  if (page !== 1) next.set('page', String(page));
  if (limit !== DEFAULT_LIMIT) next.set('limit', String(limit));
  return next;
}

export default function DeviceListPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize from URL once on mount
  const initial = useMemo(() => readStateFromParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [filters, setFilters] = useState<DeviceFilters>(initial.filters);
  const [page, setPage] = useState(initial.page);
  const [limit, setLimit] = useState(initial.limit);

  // Debounced copy of `filters.search` used to drive the API call
  const [debouncedSearch, setDebouncedSearch] = useState(initial.filters.search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [filters.search]);

  // Data state
  const [devices, setDevices] = useState<Device[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [view, setView] = useState(() => localStorage.getItem('deviceView') || 'grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);

  const [locations, setLocations] = useState<Location[]>([]);
  useEffect(() => { getLocations().then(setLocations).catch(() => {}); }, []);

  const canUpdate = useCan('devices', 'update');
  const canDelete = useCan('devices', 'delete');
  const canExport = useCan('devices', 'export');
  const hasBulkActions = canUpdate || canDelete;

  // Resolve location name → id (the filter bar still uses name)
  const locationNameToId = useMemo(() => {
    const m = new Map<string, string>();
    locations.forEach(l => m.set(l.name, l.id));
    return m;
  }, [locations]);

  // Build the params object sent to the API
  const apiParams: DeviceListParams = useMemo(() => {
    const p: DeviceListParams = { page, limit };
    if (debouncedSearch.trim()) p.search = debouncedSearch.trim();
    if (filters.type) p.type = filters.type;
    if (filters.status) p.status = filters.status;
    if (filters.location) {
      const id = locationNameToId.get(filters.location);
      if (id) p.location_id = id;
    }
    if (filters.dateFrom) p.date_from = filters.dateFrom;
    if (filters.dateTo) p.date_to = filters.dateTo;
    return p;
  }, [page, limit, debouncedSearch, filters.type, filters.status, filters.location, filters.dateFrom, filters.dateTo, locationNameToId]);

  // Sync state → URL whenever filters or pagination change
  useEffect(() => {
    setSearchParams(writeStateToParams({ ...filters, search: debouncedSearch }, page, limit), { replace: true });
  }, [filters, debouncedSearch, page, limit, setSearchParams]);

  // Fetch on param change
  const fetchDevices = useCallback(() => {
    setLoading(true);
    setError(null);
    getDevices(apiParams)
      .then(res => {
        setDevices(res.items);
        setTotal(res.total);
        setPages(res.pages);
        setSelectedIds(new Set());
      })
      .catch(() => setError('Không thể tải danh sách thiết bị'))
      .finally(() => setLoading(false));
  }, [apiParams]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  // When any filter input (or page size) changes, reset to page 1
  const prevFilterKey = useRef<string>('');
  useEffect(() => {
    const key = JSON.stringify([debouncedSearch, filters.type, filters.status, filters.location, filters.dateFrom, filters.dateTo, limit]);
    if (prevFilterKey.current && prevFilterKey.current !== key && page !== 1) {
      setPage(1);
    }
    prevFilterKey.current = key;
  }, [debouncedSearch, filters.type, filters.status, filters.location, filters.dateFrom, filters.dateTo, limit, page]);

  const handleViewChange = (newView: string) => {
    setView(newView);
    localStorage.setItem('deviceView', newView);
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev =>
      prev.size === devices.length
        ? new Set()
        : new Set(devices.map(d => d.id))
    );
  }, [devices]);

  const selectedDevices = devices.filter(d => selectedIds.has(d.id));

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

  const handleExport = async () => {
    if (total === 0) return;
    setExporting(true);
    setError(null);
    try {
      // Strip pagination — export should include ALL matching devices, not just current page
      const { page: _p, limit: _l, ...exportParams } = apiParams;
      void _p; void _l;
      const blob = await exportDevicesExcelFiltered(exportParams);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `thiet-bi-${timestamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Xuất Excel thất bại. Vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  };

  const allSelectedOnPage = devices.length > 0 && selectedIds.size === devices.length;
  const hasActiveFilters = !!(filters.search || filters.type || filters.status || filters.location || filters.dateFrom || filters.dateTo);

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <DeviceFilterBar
        filters={filters}
        onChange={setFilters}
        trailing={
          <div className="flex items-center gap-2">
            {canExport && (
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || total === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title={total === 0 ? 'Không có thiết bị để xuất' : `Xuất tất cả ${total} thiết bị phù hợp với bộ lọc`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                </svg>
                {exporting ? 'Đang xuất...' : 'Xuất Excel'}
              </button>
            )}
            <ViewToggle view={view} onChange={handleViewChange} />
          </div>
        }
      />

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && hasBulkActions && (
        <div className="flex items-center gap-3 px-5 py-3 bg-indigo-50 border border-indigo-100 rounded-2xl shadow-sm animate-slide-up">
          <span className="text-sm font-semibold text-indigo-700">
            Đã chọn {selectedIds.size} thiết bị (trang hiện tại)
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

      {error && <ErrorState message={error} onRetry={fetchDevices} />}

      {!loading && !error && devices.length === 0 && (
        <EmptyState
          icon={
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          }
          title={hasActiveFilters ? 'Không có thiết bị phù hợp với bộ lọc' : 'Chưa có thiết bị nào'}
          description={
            hasActiveFilters
              ? 'Thử thay đổi hoặc xóa bộ lọc để xem kết quả khác.'
              : 'Nhấn nút thêm ở góc phải (hoặc bên dưới) để bắt đầu tạo thiết bị quản lý đầu tiên.'
          }
        />
      )}

      {/* Grid View */}
      {!loading && devices.length > 0 && view === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {devices.map((device, index) => (
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
      {!loading && devices.length > 0 && view === 'list' && (
        <div className="card-glass bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-slate-50/50">
              <tr>
                {hasBulkActions && (
                  <th className="w-12 px-4 py-4 border-b border-slate-100">
                    <input
                      type="checkbox"
                      checked={allSelectedOnPage}
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
              {devices.map((device) => (
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

      {/* Pagination */}
      {!loading && total > 0 && (
        <Pagination
          page={page}
          pages={pages}
          total={total}
          limit={limit}
          onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          itemLabel="thiết bị"
        />
      )}
    </div>
  );
}

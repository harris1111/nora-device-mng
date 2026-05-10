import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  attachmentFileUrl,
  getDevices,
  exportDevicesExcelFiltered,
  bulkDeleteDevices,
  getLocations,
  getAreas,
  getTransferUnits,
  Device,
  DeviceListParams,
  Location,
  Area,
} from '../api/device-api';
import { useCan } from '../hooks/use-permission';
import DeviceCard from '../components/device/device-card';
import DeviceListRow from '../components/device/device-list-row';
import DeviceStatusBadge from '../components/device/device-status-badge';
import { getTypeName } from '../components/device/device-constants';
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
      area: params.get('area') || '',
      transferUnit: params.get('transfer_unit') || '',
      maintenance: params.get('maintenance_status') || '',
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
  if (filters.area) next.set('area', filters.area);
  if (filters.transferUnit) next.set('transfer_unit', filters.transferUnit);
  if (filters.maintenance) next.set('maintenance_status', filters.maintenance);
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

  const [areas, setAreas] = useState<Area[]>([]);
  useEffect(() => { getAreas().then(setAreas).catch(() => {}); }, []);

  // Distinct transfer-unit values for the filter dropdown (server-provided, RBAC-aware)
  const [transferUnits, setTransferUnits] = useState<string[]>([]);
  useEffect(() => { getTransferUnits().then(setTransferUnits).catch(() => {}); }, []);

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

  // Resolve area name → id (the filter bar still uses name)
  const areaNameToId = useMemo(() => {
    const m = new Map<string, string>();
    areas.forEach(a => m.set(a.name, a.id));
    return m;
  }, [areas]);

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
    if (filters.area) {
      const id = areaNameToId.get(filters.area);
      if (id) p.area_id = id;
    }
    if (filters.transferUnit) p.transfer_unit = filters.transferUnit;
    if (filters.maintenance) p.maintenance_status = filters.maintenance;
    if (filters.dateFrom) p.date_from = filters.dateFrom;
    if (filters.dateTo) p.date_to = filters.dateTo;
    return p;
  }, [page, limit, debouncedSearch, filters.type, filters.status, filters.location, filters.area, filters.transferUnit, filters.maintenance, filters.dateFrom, filters.dateTo, locationNameToId, areaNameToId]);

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
    const key = JSON.stringify([debouncedSearch, filters.type, filters.status, filters.location, filters.area, filters.transferUnit, filters.maintenance, filters.dateFrom, filters.dateTo, limit]);
    if (prevFilterKey.current && prevFilterKey.current !== key && page !== 1) {
      setPage(1);
    }
    prevFilterKey.current = key;
  }, [debouncedSearch, filters.type, filters.status, filters.location, filters.area, filters.transferUnit, filters.maintenance, filters.dateFrom, filters.dateTo, limit, page]);

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
  const hasActiveFilters = !!(filters.search || filters.type || filters.status || filters.location || filters.area || filters.transferUnit || filters.dateFrom || filters.dateTo);
  const isSearchPending = filters.search !== debouncedSearch;
  const resultSummary = loading
    ? 'Đang cập nhật danh sách thiết bị...'
    : total > 0
      ? `${total} thiết bị phù hợp${hasActiveFilters ? ' với bộ lọc hiện tại' : ''}`
      : hasActiveFilters
        ? 'Không có thiết bị phù hợp với bộ lọc hiện tại'
        : 'Chưa có thiết bị trong hệ thống';

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Khám phá thiết bị</p>
            <h3 className="text-lg font-bold text-slate-800">Danh sách thiết bị</h3>
            <p className="text-sm text-slate-500">{resultSummary}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            <ViewToggle view={view} onChange={handleViewChange} />
            {canExport && (
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || total === 0}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                title={total === 0 ? 'Không có thiết bị để xuất' : `Xuất tất cả ${total} thiết bị phù hợp với bộ lọc`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                </svg>
                {exporting ? 'Đang xuất...' : 'Xuất Excel'}
              </button>
            )}
          </div>
        </div>
      </section>

      <DeviceFilterBar
        filters={filters}
        onChange={setFilters}
        areas={areas}
        transferUnits={transferUnits}
        isSearching={isSearchPending}
      />

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && hasBulkActions && (
        <div className="animate-slide-up rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-4 shadow-sm sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-indigo-700">Đã chọn {selectedIds.size} thiết bị trên trang hiện tại</p>
              <p className="text-sm text-indigo-600/80">Thực hiện thao tác hàng loạt hoặc bỏ chọn để quay lại chế độ duyệt.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {canUpdate && (
                <button
                  onClick={() => setShowBulkEdit(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Sửa hàng loạt
                </button>
              )}
              {canDelete && (
                <button
                  onClick={handleBulkDelete}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Xóa hàng loạt
                </button>
              )}
              <button
                onClick={() => setSelectedIds(new Set())}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
              >
                Bỏ chọn
              </button>
            </div>
          </div>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {devices.map((device, index) => (
            <div key={device.id} className="animate-slide-up" style={{ animationDelay: `${Math.min(index * 50, 500)}ms`, animationFillMode: 'both' }}>
              <DeviceCard
                device={device}
                selectionControl={hasBulkActions ? (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(device.id)}
                    onChange={() => toggleSelect(device.id)}
                    aria-label={`Chọn thiết bị ${device.name}`}
                    className="h-5 w-5 rounded-md border-2 border-slate-300 bg-white text-indigo-600 shadow-sm focus:ring-indigo-500"
                  />
                ) : undefined}
              />
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {!loading && devices.length > 0 && view === 'list' && (
        <>
          <div className="space-y-3 md:hidden">
            {devices.map((device) => {
              const thumbUrl = device.primary_attachment_id ? attachmentFileUrl(device.primary_attachment_id) : null;

              return (
                <article key={device.id} className={`rounded-2xl border bg-white p-4 shadow-sm transition-colors ${selectedIds.has(device.id) ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200'}`}>
                  <div className="flex items-start gap-3">
                    {hasBulkActions && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(device.id)}
                        onChange={() => toggleSelect(device.id)}
                        aria-label={`Chọn thiết bị ${device.name}`}
                        className="mt-1 h-5 w-5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    )}

                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
                      {thumbUrl ? (
                        <img src={thumbUrl} alt={device.name} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <svg className="h-7 w-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="mb-2 inline-flex rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-semibold text-slate-600">
                            {device.store_id}
                          </div>
                          <Link to={`/devices/${device.id}`} className="block text-base font-bold text-slate-800 transition-colors hover:text-indigo-600">
                            <span className="line-clamp-2">{device.name}</span>
                          </Link>
                        </div>
                        <Link to={`/devices/${device.id}`} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-colors hover:text-indigo-600">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <DeviceStatusBadge status={device.status} />
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {getTypeName(device.type)}
                        </span>
                      </div>

                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        <div className="line-clamp-2">Đơn vị: {device.location_name || 'Chưa có'}</div>
                        {device.area_name && <div className="line-clamp-2">Khu vực: {device.area_name}</div>}
                        {device.owned_by && <div className="line-clamp-2">Chuyển giao: {[device.location_name, device.owned_by].filter(Boolean).join(' → ')}</div>}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm md:block">
            <table className="w-full border-collapse whitespace-nowrap text-left">
              <thead className="bg-slate-50/50">
                <tr>
                  {hasBulkActions && (
                    <th className="w-12 border-b border-slate-100 px-4 py-4">
                      <input
                        type="checkbox"
                        checked={allSelectedOnPage}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                  )}
                  <th className="border-b border-slate-100 px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Hình ảnh</th>
                  <th className="border-b border-slate-100 px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Mã thiết bị</th>
                  <th className="border-b border-slate-100 px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Tên thiết bị</th>
                  <th className="border-b border-slate-100 px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Loại thiết bị</th>
                  <th className="border-b border-slate-100 px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Trạng thái</th>
                  <th className="border-b border-slate-100 px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Đơn vị trực thuộc</th>
                  <th className="border-b border-slate-100 px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Khu vực</th>
                  <th className="border-b border-slate-100 px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Chuyển giao</th>
                  <th className="border-b border-slate-100 px-6 py-4"></th>
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
        </>
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

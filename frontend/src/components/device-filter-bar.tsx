import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getLocations, type Area, type Device, type Location } from '../api/device-api';
import { ALL_STATUSES, DEVICE_TYPES, STATUS_BY_TYPE } from './device/device-constants';
import VnDatePicker from './ui/vn-date-picker';

export interface DeviceFilters {
  search: string;
  type: string;
  status: string;
  location: string;
  area: string;
  transferUnit: string;
  maintenance: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: DeviceFilters = {
  search: '',
  type: '',
  status: '',
  location: '',
  area: '',
  transferUnit: '',
  maintenance: '',
  dateFrom: '',
  dateTo: '',
};

const MAINTENANCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'in_use', label: 'Bình thường' },
  { value: 'needs_maintenance', label: 'Cần bảo trì' },
];

interface Props {
  filters: DeviceFilters;
  onChange: (filters: DeviceFilters) => void;
  areas?: Area[];
  transferUnits?: string[];
  trailing?: ReactNode;
  isSearching?: boolean;
}

export function useDeviceFilter(devices: Device[], filters: DeviceFilters) {
  return useMemo(() => {
    return devices.filter((device) => {
      if (filters.type && device.type !== filters.type) return false;
      if (filters.status && device.status !== filters.status) return false;
      if (filters.location && device.location_name !== filters.location) return false;
      if (filters.area && (device.area_name || '') !== filters.area) return false;
      if (filters.transferUnit && (device.owned_by || '') !== filters.transferUnit) return false;
      if (filters.maintenance && (device.maintenance_status || 'in_use') !== filters.maintenance) return false;

      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        if (new Date(device.created_at) < from) return false;
      }

      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(device.created_at) > to) return false;
      }

      if (filters.search.trim()) {
        const query = filters.search.toLowerCase();
        const fields = [
          device.name,
          device.store_id,
          device.location_name,
          device.serial_number,
          device.manufacturer,
          device.model,
          device.owned_by,
        ];

        if (!fields.some((field) => field?.toLowerCase().includes(query))) return false;
      }

      return true;
    });
  }, [devices, filters]);
}

export default function DeviceFilterBar({
  filters,
  onChange,
  areas = [],
  transferUnits = [],
  trailing,
  isSearching = false,
}: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    getLocations().then(setLocations).catch(() => {});
  }, []);

  useEffect(() => {
    if (filters.location || filters.area || filters.transferUnit || filters.maintenance || filters.dateFrom || filters.dateTo) {
      setShowAdvanced(true);
    }
  }, [filters.location, filters.area, filters.transferUnit, filters.maintenance, filters.dateFrom, filters.dateTo]);

  const set = (patch: Partial<DeviceFilters>) => {
    const next = { ...filters, ...patch };
    if (patch.type !== undefined && patch.type !== filters.type) next.status = '';
    onChange(next);
  };

  const statusOptions = filters.type
    ? STATUS_BY_TYPE[filters.type] || []
    : Object.entries(ALL_STATUSES).map(([value, { label }]) => ({ value, label }));

  const activeAdvancedCount = [filters.location, filters.area, filters.transferUnit, filters.maintenance, filters.dateFrom, filters.dateTo].filter(Boolean).length;
  const hasAnyFilter = !!(filters.search || filters.type || filters.status || filters.location || filters.area || filters.transferUnit || filters.maintenance || filters.dateFrom || filters.dateTo);
  const activeFilterLabels = [
    filters.type && `Loại: ${DEVICE_TYPES.find((item) => item.value === filters.type)?.label || filters.type}`,
    filters.status && `Trạng thái: ${statusOptions.find((item) => item.value === filters.status)?.label || filters.status}`,
    filters.location && `Đơn vị: ${filters.location}`,
    filters.area && `Khu vực: ${filters.area}`,
    filters.transferUnit && `Chuyển giao: ${filters.transferUnit}`,
    filters.maintenance && `Bảo trì: ${MAINTENANCE_OPTIONS.find((item) => item.value === filters.maintenance)?.label || filters.maintenance}`,
    filters.dateFrom && `Từ ngày: ${filters.dateFrom}`,
    filters.dateTo && `Đến ngày: ${filters.dateTo}`,
  ].filter(Boolean) as string[];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)]">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Tìm kiếm và lọc thiết bị</h3>
            <p className="mt-1 text-sm text-slate-500">Ưu tiên tìm theo tên, mã, trạng thái và mở rộng thêm bộ lọc khi cần.</p>
          </div>
          {trailing && <div className="flex flex-wrap items-center gap-2">{trailing}</div>}
        </div>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,2.2fr)_minmax(180px,0.75fr)_minmax(200px,0.85fr)]">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Tìm kiếm</span>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={filters.search}
                onChange={(event) => set({ search: event.target.value })}
                className="block w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-20 text-sm text-slate-800 transition-shadow placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                placeholder="Tìm theo tên, mã thiết bị, đơn vị, serial hoặc nhà sản xuất..."
              />
              <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-3">
                {isSearching && <span className="text-xs font-medium text-indigo-600">Đang tìm...</span>}
                {filters.search && (
                  <button
                    type="button"
                    onClick={() => set({ search: '' })}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                    aria-label="Xóa từ khóa tìm kiếm"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Loại thiết bị</span>
            <select
              value={filters.type}
              onChange={(event) => set({ type: event.target.value })}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 transition-shadow focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Tất cả loại</option>
              {DEVICE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Trạng thái</span>
            <select
              value={filters.status}
              onChange={(event) => set({ status: event.target.value })}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 transition-shadow focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Tất cả trạng thái</option>
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdvanced((value) => !value)}
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                showAdvanced || activeAdvancedCount > 0
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {showAdvanced ? 'Ẩn bộ lọc nâng cao' : 'Mở bộ lọc nâng cao'}
              {activeAdvancedCount > 0 && (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-bold text-white">
                  {activeAdvancedCount}
                </span>
              )}
            </button>

            {hasAnyFilter && (
              <button
                type="button"
                onClick={() => onChange({ ...EMPTY_FILTERS })}
                className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Xóa toàn bộ bộ lọc
              </button>
            )}
          </div>

          {hasAnyFilter && (
            <p className="text-sm text-slate-500">
              {filters.search ? 'Đang lọc theo từ khóa và điều kiện đã chọn.' : 'Đang áp dụng các điều kiện lọc hiện tại.'}
            </p>
          )}
        </div>

        {activeFilterLabels.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeFilterLabels.map((label) => (
              <span key={label} className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                {label}
              </span>
            ))}
          </div>
        )}

        {showAdvanced && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Bộ lọc nâng cao</h4>
                <p className="text-sm text-slate-500">Thu hẹp danh sách theo đơn vị, khu vực, chuyển giao và mốc thời gian.</p>
              </div>
              {activeAdvancedCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
                  {activeAdvancedCount} điều kiện nâng cao đang bật
                </span>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Đơn vị</span>
                <select
                  value={filters.location}
                  onChange={(event) => set({ location: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 transition-shadow focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Tất cả đơn vị</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.name}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Khu vực</span>
                <select
                  value={filters.area}
                  onChange={(event) => set({ area: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 transition-shadow focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Tất cả khu vực</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.name}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Đơn vị chuyển giao</span>
                <select
                  value={filters.transferUnit}
                  onChange={(event) => set({ transferUnit: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 transition-shadow focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Tất cả đơn vị chuyển giao</option>
                  {transferUnits.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Tình trạng bảo trì</span>
                <select
                  value={filters.maintenance}
                  onChange={(event) => set({ maintenance: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 transition-shadow focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Tất cả tình trạng bảo trì</option>
                  {MAINTENANCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Từ ngày</span>
                <VnDatePicker
                  value={filters.dateFrom}
                  onChange={(v) => set({ dateFrom: v })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 transition-shadow focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 text-left flex items-center justify-between gap-2"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Đến ngày</span>
                <VnDatePicker
                  value={filters.dateTo}
                  onChange={(v) => set({ dateTo: v })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 transition-shadow focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 text-left flex items-center justify-between gap-2"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export { EMPTY_FILTERS };

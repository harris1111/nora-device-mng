import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { getLocations, type Location, type Device } from '../api/device-api';
import { DEVICE_TYPES, STATUS_BY_TYPE, ALL_STATUSES } from './device-constants';

export interface DeviceFilters {
  search: string;
  type: string;
  status: string;
  location: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: DeviceFilters = { search: '', type: '', status: '', location: '', dateFrom: '', dateTo: '' };

interface Props {
  filters: DeviceFilters;
  onChange: (filters: DeviceFilters) => void;
  /** Extra controls rendered at the end (e.g. ViewToggle) */
  trailing?: ReactNode;
}

export function useDeviceFilter(devices: Device[], filters: DeviceFilters) {
  return useMemo(() => {
    return devices.filter((d) => {
      if (filters.type && d.type !== filters.type) return false;
      if (filters.status && d.status !== filters.status) return false;
      if (filters.location && d.location_name !== filters.location) return false;

      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        if (new Date(d.created_at) < from) return false;
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(d.created_at) > to) return false;
      }

      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const fields = [d.name, d.store_id, d.location_name, d.serial_number, d.manufacturer, d.model, d.owned_by];
        if (!fields.some(f => f?.toLowerCase().includes(q))) return false;
      }

      return true;
    });
  }, [devices, filters]);
}

export default function DeviceFilterBar({ filters, onChange, trailing }: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    getLocations().then(setLocations).catch(() => {});
  }, []);

  // Auto-show advanced panel if any advanced filter is active
  useEffect(() => {
    if (filters.location || filters.dateFrom || filters.dateTo) {
      setShowAdvanced(true);
    }
  }, [filters.location, filters.dateFrom, filters.dateTo]);

  const set = (patch: Partial<DeviceFilters>) => {
    const next = { ...filters, ...patch };
    // Reset status when type changes
    if (patch.type !== undefined && patch.type !== filters.type) next.status = '';
    onChange(next);
  };

  const statusOptions = filters.type
    ? (STATUS_BY_TYPE[filters.type] || [])
    : Object.entries(ALL_STATUSES).map(([value, { label }]) => ({ value, label }));

  const activeAdvancedCount = [filters.location, filters.dateFrom, filters.dateTo].filter(Boolean).length;

  const clearAll = () => onChange({ ...EMPTY_FILTERS });
  const hasAnyFilter = filters.search || filters.type || filters.status || filters.location || filters.dateFrom || filters.dateTo;

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-slate-100">
      {/* Primary row */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-3 p-4">
        {/* Search */}
        <div className="flex-1 w-full relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4.5 w-4.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            className="block w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow placeholder:text-slate-400"
            placeholder="Tìm kiếm tên, mã, đơn vị, serial, nhà SX..."
          />
        </div>

        {/* Type */}
        <select
          value={filters.type}
          onChange={(e) => set({ type: e.target.value })}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[140px]"
        >
          <option value="">Tất cả loại</option>
          {DEVICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        {/* Status */}
        <select
          value={filters.status}
          onChange={(e) => set({ status: e.target.value })}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[160px]"
        >
          <option value="">Tất cả trạng thái</option>
          {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        {/* Advanced toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(v => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors shrink-0 ${
            showAdvanced || activeAdvancedCount > 0
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Bộ lọc
          {activeAdvancedCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-indigo-600 rounded-full">
              {activeAdvancedCount}
            </span>
          )}
        </button>

        {/* Clear all */}
        {hasAnyFilter && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Xóa lọc
          </button>
        )}

        {trailing}
      </div>

      {/* Advanced filters row */}
      {showAdvanced && (
        <div className="border-t border-slate-100 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-50/50 rounded-b-2xl">
          {/* Location */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Đơn vị</label>
            <select
              value={filters.location}
              onChange={(e) => set({ location: e.target.value })}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[160px]"
            >
              <option value="">Tất cả đơn vị</option>
              {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
            </select>
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Từ ngày</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => set({ dateFrom: e.target.value })}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Đến ngày</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => set({ dateTo: e.target.value })}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export { EMPTY_FILTERS };

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  exportDevicesExcel,
  exportDevicesExcelFiltered,
  getAreas,
  getExcelExportPreview,
  getExcelExportOptions,
  getLocations,
  getTransferUnits,
  type Area,
  type Device,
  type ExcelExportOptionsResponse,
  type Location,
} from '../api/device-api';
import DeviceFilterBar, { EMPTY_FILTERS, type DeviceFilters } from '../components/device-filter-bar';
import ExcelExportActionBar from '../components/export/excel-export-action-bar';
import ExcelExportColumnPicker from '../components/export/excel-export-column-picker';
import ExcelExportPreviewTable from '../components/export/excel-export-preview-table';
import ExcelExportTypeSelector from '../components/export/excel-export-type-selector';
import { useCan } from '../hooks/use-permission';
import { buildExcelPreviewParams } from '../utils/excel-export-filter-params';
import { downloadExcel, getDefaultColumnKeys, mapByName } from '../utils/excel-export-page-utils';
import { ExcelExportDenied, ExcelExportLoading } from '../components/export/excel-export-access-state';

const SEARCH_DEBOUNCE_MS = 300;

export default function ExcelExportPage() {
  const canExport = useCan('devices', 'export');
  const [options, setOptions] = useState<ExcelExportOptionsResponse | null>(null);
  const [exportType, setExportType] = useState('devices');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<DeviceFilters>({ ...EMPTY_FILTERS });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [total, setTotal] = useState(0);
  const [locations, setLocations] = useState<Location[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [transferUnits, setTransferUnits] = useState<string[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [exporting, setExporting] = useState<'all' | 'selected' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    let cancelled = false;
    setLoadingConfig(true);
    Promise.all([getExcelExportOptions(), getLocations(), getAreas(), getTransferUnits()])
      .then(([excelOptions, locationRows, areaRows, transferUnitRows]) => {
        if (cancelled) return;
        const firstType = excelOptions.export_types[0]?.key || 'devices';
        setOptions(excelOptions);
        setExportType(firstType);
        setSelectedColumns(getDefaultColumnKeys(excelOptions.columns[firstType] || []));
        setLocations(locationRows);
        setAreas(areaRows);
        setTransferUnits(transferUnitRows);
      })
      .catch(() => setError('Không thể tải cấu hình xuất Excel'))
      .finally(() => {
        if (!cancelled) setLoadingConfig(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!options) return;
    setSelectedColumns(getDefaultColumnKeys(options.columns[exportType] || []));
    setSelectedIds(new Set());
  }, [exportType, options]);

  const locationNameToId = useMemo(() => mapByName(locations), [locations]);
  const areaNameToId = useMemo(() => mapByName(areas), [areas]);

  const apiParams = useMemo(
    () => buildExcelPreviewParams(filters, debouncedSearch, locationNameToId, areaNameToId),
    [areaNameToId, debouncedSearch, filters, locationNameToId],
  );

  const fetchPreview = useCallback(() => {
    setLoadingPreview(true);
    setError(null);
    getExcelExportPreview(apiParams)
      .then((res) => {
        setDevices(res.items);
        setTotal(res.total);
        setSelectedIds(new Set());
      })
      .catch(() => setError('Không thể tải danh sách thiết bị'))
      .finally(() => setLoadingPreview(false));
  }, [apiParams]);

  useEffect(() => { fetchPreview(); }, [fetchPreview]);

  const currentColumns = options?.columns[exportType] || [];
  const selectedColumnOptions = currentColumns.filter((column) => selectedColumns.includes(column.key));
  const exportLabel = options?.export_types.find((type) => type.key === exportType)?.label || 'Excel';
  const isSearchPending = filters.search !== debouncedSearch;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    const allSelected = devices.length > 0 && devices.every((device) => selectedIds.has(device.id));
    setSelectedIds(allSelected ? new Set() : new Set(devices.map((device) => device.id)));
  };

  const exportRequest = { exportType, columns: selectedColumns };

  const handleExportSelected = async () => {
    if (selectedIds.size === 0 || selectedColumns.length === 0) return;
    setExporting('selected');
    setError(null);
    try {
      const blob = await exportDevicesExcel(Array.from(selectedIds), exportRequest);
      downloadExcel(blob, 'thiet-bi-da-chon');
    } catch (event) {
      const msg = (event as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Xuất Excel thất bại. Vui lòng thử lại.');
    } finally {
      setExporting(null);
    }
  };

  const handleExportAll = async () => {
    if (total === 0 || selectedColumns.length === 0) return;
    setExporting('all');
    setError(null);
    try {
      const { page: _page, limit: _limit, ...exportParams } = apiParams;
      void _page; void _limit;
      const blob = await exportDevicesExcelFiltered(exportParams, exportRequest);
      downloadExcel(blob, 'thiet-bi');
    } catch (event) {
      const msg = (event as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Xuất Excel thất bại. Vui lòng thử lại.');
    } finally {
      setExporting(null);
    }
  };

  if (!canExport) return <ExcelExportDenied />;
  if (loadingConfig) return <ExcelExportLoading />;

  return (
    <div className="space-y-5">
      <ExcelExportActionBar
        exportLabel={exportLabel}
        total={total}
        selectedColumnCount={selectedColumnOptions.length}
        selectedRowCount={selectedIds.size}
        exporting={exporting}
        onExportAll={handleExportAll}
        onExportSelected={handleExportSelected}
      />

      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {options && (
        <ExcelExportTypeSelector types={options.export_types} selectedType={exportType} onChange={setExportType} />
      )}

      <DeviceFilterBar
        filters={filters}
        onChange={setFilters}
        locations={locations}
        areas={areas}
        transferUnits={transferUnits}
        isSearching={isSearchPending}
      />

      <ExcelExportColumnPicker columns={currentColumns} selectedColumns={selectedColumns} onChange={setSelectedColumns} />

      <ExcelExportPreviewTable
        devices={devices}
        columns={selectedColumnOptions}
        selectedIds={selectedIds}
        loading={loadingPreview}
        total={total}
        onToggle={toggleSelected}
        onToggleAll={toggleAllVisible}
      />
    </div>
  );
}

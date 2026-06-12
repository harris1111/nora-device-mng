import type { DeviceListParams } from '../api/device-api';
import type { DeviceFilters } from '../components/device-filter-bar';

export function buildExcelPreviewParams(
  filters: DeviceFilters,
  debouncedSearch: string,
  locationNameToId: Map<string, string>,
  areaNameToId: Map<string, string>,
  limit: number,
): DeviceListParams {
  const params: DeviceListParams = { page: 1, limit };
  if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
  if (filters.type) params.type = filters.type;
  if (filters.status) params.status = filters.status;
  if (filters.location) params.location_id = locationNameToId.get(filters.location);
  if (filters.area) params.area_id = areaNameToId.get(filters.area);
  if (filters.transferUnit) params.transfer_unit = filters.transferUnit;
  if (filters.maintenance) params.maintenance_status = filters.maintenance;
  if (filters.inventory) params.inventory_status = filters.inventory;
  if (filters.dateFrom) params.date_from = filters.dateFrom;
  if (filters.dateTo) params.date_to = filters.dateTo;
  return params;
}

import type { Device, ExcelExportColumnOption } from '../../api/device-api';
import { getStatusInfo, getTypeName } from '../device/device-constants';

interface Props {
  devices: Device[];
  columns: ExcelExportColumnOption[];
  selectedIds: Set<string>;
  loading: boolean;
  total: number;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString('vi-VN') : '';
}

function getPreviewValue(device: Device, key: string, index: number): string | number {
  if (key === 'stt') return index + 1;
  if (key === 'store_id') return device.store_id;
  if (key === 'name') return device.name;
  if (key === 'type') return getTypeName(device.type);
  if (key === 'status') return getStatusInfo(device.status).label;
  if (key === 'location') return device.location_name || '';
  if (key === 'area') return device.area_name || '';
  if (key === 'owned_by') return device.owned_by || '';
  if (key === 'transfer_to') return device.transfer_to || (device.owned_by ? [device.location_name, device.owned_by].filter(Boolean).join(' → ') : '');
  if (key === 'serial_number') return device.serial_number || '';
  if (key === 'manufacturer') return device.manufacturer || '';
  if (key === 'model') return device.model || '';
  if (key === 'warranty_period') return device.warranty_period || '';
  if (key === 'maintenance_status') return device.maintenance_status === 'needs_maintenance' ? 'Cần bảo trì' : 'Bình thường';
  if (key === 'inventory_status') return device.inventory_status === 'needs_inventory' ? 'Cần kiểm kê' : 'Bình thường';
  if (key === 'created_at') return formatDate(device.created_at);
  if (key === 'qrcode') return 'QR';
  return '';
}

export default function ExcelExportPreviewTable({ devices, columns, selectedIds, loading, total, onToggle, onToggleAll }: Props) {
  const allSelected = devices.length > 0 && devices.every((device) => selectedIds.has(device.id));
  const tableMinWidth = Math.max(760, columns.length * 150 + 64);

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="section-eyebrow">Xem trước</p>
          <h2 className="text-base font-bold text-slate-800">{total} thiết bị phù hợp</h2>
        </div>
        <p className="text-sm text-slate-500">Đã chọn {selectedIds.size} dòng</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth: tableMinWidth }}>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="w-14 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  disabled={devices.length === 0}
                  aria-label="Chọn tất cả thiết bị trong bảng xem trước"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                />
              </th>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={index}>
                  <td className="px-4 py-4"><div className="h-4 w-4 rounded bg-slate-200" /></td>
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-4"><div className="h-3 w-24 rounded bg-slate-200" /></td>
                  ))}
                </tr>
              ))
            )}

            {!loading && devices.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-sm text-slate-400">
                  Không có thiết bị phù hợp.
                </td>
              </tr>
            )}

            {!loading && devices.map((device, index) => (
              <tr
                key={device.id}
                onClick={() => onToggle(device.id)}
                className={`cursor-pointer transition-colors hover:bg-slate-50 ${selectedIds.has(device.id) ? 'bg-indigo-50/60' : 'bg-white'}`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(device.id)}
                    onChange={() => onToggle(device.id)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Chọn thiết bị ${device.name}`}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </td>
                {columns.map((column) => (
                  <td key={column.key} className="max-w-64 px-4 py-3 text-slate-700">
                    <span className="line-clamp-2">{getPreviewValue(device, column.key, index)}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

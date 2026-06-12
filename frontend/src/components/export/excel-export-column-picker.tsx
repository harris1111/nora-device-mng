import { useMemo } from 'react';
import type { ExcelExportColumnOption } from '../../api/device-api';

interface Props {
  columns: ExcelExportColumnOption[];
  selectedColumns: string[];
  onChange: (columns: string[]) => void;
}

export default function ExcelExportColumnPicker({ columns, selectedColumns, onChange }: Props) {
  const selectedSet = useMemo(() => new Set(selectedColumns), [selectedColumns]);
  const defaultColumns = useMemo(() => columns.filter((column) => column.default).map((column) => column.key), [columns]);
  const allSelected = columns.length > 0 && columns.every((column) => selectedSet.has(column.key));

  const applyColumnOrder = (keys: string[]) => {
    const keySet = new Set(keys);
    return columns.filter((column) => keySet.has(column.key)).map((column) => column.key);
  };

  const toggleColumn = (key: string) => {
    const next = selectedSet.has(key)
      ? selectedColumns.filter((column) => column !== key)
      : [...selectedColumns, key];
    if (next.length > 0) onChange(applyColumnOrder(next));
  };

  return (
    <div className="panel p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="section-eyebrow">Cột dữ liệu</p>
          <h2 className="text-base font-bold text-slate-800">{selectedColumns.length} / {columns.length} cột được chọn</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange(defaultColumns)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Mặc định
          </button>
          <button
            type="button"
            onClick={() => onChange(allSelected ? defaultColumns : columns.map((column) => column.key))}
            className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            {allSelected ? 'Rút gọn' : 'Chọn tất cả'}
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {columns.map((column) => {
          const selected = selectedSet.has(column.key);
          const cannotRemove = selected && selectedColumns.length === 1;
          return (
            <label
              key={column.key}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                selected
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <input
                type="checkbox"
                checked={selected}
                disabled={cannotRemove}
                onChange={() => toggleColumn(column.key)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
              />
              <span className="min-w-0 flex-1 truncate font-medium">{column.label}</span>
              {column.default && (
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                  Chuẩn
                </span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}

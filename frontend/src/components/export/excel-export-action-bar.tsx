interface Props {
  exportLabel: string;
  total: number;
  selectedColumnCount: number;
  selectedRowCount: number;
  exporting: 'all' | 'selected' | null;
  onExportAll: () => void;
  onExportSelected: () => void;
}

export default function ExcelExportActionBar({
  exportLabel,
  total,
  selectedColumnCount,
  selectedRowCount,
  exporting,
  onExportAll,
  onExportSelected,
}: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Excel</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">{exportLabel}</h1>
        <p className="mt-1 text-sm text-slate-500">{total} thiết bị phù hợp, {selectedColumnCount} cột dữ liệu.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={onExportSelected}
          disabled={selectedRowCount === 0 || selectedColumnCount === 0 || exporting !== null}
          className="btn btn-ghost"
        >
          {exporting === 'selected' ? 'Đang xuất...' : `Xuất ${selectedRowCount} dòng`}
        </button>
        <button
          type="button"
          onClick={onExportAll}
          disabled={total === 0 || selectedColumnCount === 0 || exporting !== null}
          className="btn btn-success"
        >
          {exporting === 'all' ? 'Đang xuất...' : 'Xuất theo bộ lọc'}
        </button>
      </div>
    </div>
  );
}

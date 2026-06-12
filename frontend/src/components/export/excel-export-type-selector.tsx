import type { ExcelExportTypeOption } from '../../api/device-api';

interface Props {
  types: ExcelExportTypeOption[];
  selectedType: string;
  onChange: (type: string) => void;
}

export default function ExcelExportTypeSelector({ types, selectedType, onChange }: Props) {
  return (
    <div className="panel p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="section-eyebrow">Loại Excel</p>
          <h2 className="text-base font-bold text-slate-800">Mẫu xuất dữ liệu</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
          {types.length} mẫu
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {types.map((type) => {
          const selected = type.key === selectedType;
          return (
            <button
              key={type.key}
              type="button"
              onClick={() => onChange(type.key)}
              className={`flex min-h-24 items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                selected
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-slate-50'
              }`}
              aria-pressed={selected}
            >
              <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-white text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6m3 6V7m3 10v-3M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">{type.label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">Danh mục quản lý thiết bị.</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

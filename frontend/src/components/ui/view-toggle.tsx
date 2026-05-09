// Toggle between grid (thumbnail) and list view

interface Props {
  view: string;
  onChange: (view: string) => void;
}

export default function ViewToggle({ view, onChange }: Props) {
  return (
    <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1 shadow-sm">
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={[
          'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
          view === 'grid'
            ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-100'
            : 'text-slate-500 hover:text-slate-700'
        ].join(' ')}
        title="Dạng lưới"
        aria-pressed={view === 'grid'}
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
        <span className="hidden sm:inline">Lưới</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        className={[
          'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
          view === 'list'
            ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-100'
            : 'text-slate-500 hover:text-slate-700'
        ].join(' ')}
        title="Dạng danh sách"
        aria-pressed={view === 'list'}
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
        <span className="hidden sm:inline">Danh sách</span>
      </button>
    </div>
  );
}

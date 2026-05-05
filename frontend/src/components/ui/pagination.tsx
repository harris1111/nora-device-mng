interface Props {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  pageSizeOptions?: number[];
  /** Word for the items being paginated, e.g. "thiết bị". */
  itemLabel?: string;
}

const DEFAULT_PAGE_SIZES = [5, 10, 20, 100];

/**
 * Build the list of page tokens with ellipsis collapsing.
 * Always shows first, last, current, and one neighbour on each side.
 */
function buildPageTokens(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const tokens: (number | 'gap')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) tokens.push('gap');
  for (let p = start; p <= end; p++) tokens.push(p);
  if (end < total - 1) tokens.push('gap');
  tokens.push(total);
  return tokens;
}

export default function Pagination({
  page,
  pages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  itemLabel = 'mục',
}: Props) {
  const safePages = Math.max(1, pages);
  const safePage = Math.min(Math.max(1, page), safePages);
  const startItem = total === 0 ? 0 : (safePage - 1) * limit + 1;
  const endItem = Math.min(safePage * limit, total);
  const tokens = buildPageTokens(safePage, safePages);

  const go = (p: number) => {
    if (p < 1 || p > safePages || p === safePage) return;
    onPageChange(p);
  };

  const navBtn = (label: React.ReactNode, target: number, disabled: boolean, ariaLabel: string) => (
    <button
      type="button"
      onClick={() => go(target)}
      disabled={disabled}
      aria-label={ariaLabel}
      className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-slate-200 transition-colors"
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 py-3 bg-white border border-slate-100 rounded-2xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)]">
      {/* Left: range + page size */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
        <span>
          {total === 0 ? (
            <>Không có {itemLabel} nào</>
          ) : (
            <>Hiển thị <span className="font-semibold text-slate-800">{startItem}</span>–<span className="font-semibold text-slate-800">{endItem}</span> trên <span className="font-semibold text-slate-800">{total}</span> {itemLabel}</>
          )}
        </span>
        <div className="flex items-center gap-2">
          <label htmlFor="page-size" className="text-xs font-medium text-slate-500">Kích thước trang</label>
          <select
            id="page-size"
            value={limit}
            onChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {pageSizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Right: navigation */}
      <div className="flex items-center gap-1.5" role="navigation" aria-label="Pagination">
        {navBtn('«', 1, safePage <= 1, 'First page')}
        {navBtn('‹', safePage - 1, safePage <= 1, 'Previous page')}
        {tokens.map((tok, i) =>
          tok === 'gap' ? (
            <span key={`gap-${i}`} className="px-2 text-slate-400 select-none">…</span>
          ) : (
            <button
              key={tok}
              type="button"
              onClick={() => go(tok)}
              aria-current={tok === safePage ? 'page' : undefined}
              className={
                tok === safePage
                  ? 'inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold shadow-sm'
                  : 'inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors'
              }
            >
              {tok}
            </button>
          )
        )}
        {navBtn('›', safePage + 1, safePage >= safePages, 'Next page')}
        {navBtn('»', safePages, safePage >= safePages, 'Last page')}
      </div>
    </div>
  );
}

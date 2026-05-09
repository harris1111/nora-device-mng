import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Vietnamese date picker — replaces native <input type="date"> so the
 * calendar UI is always rendered in Vietnamese (not the browser's locale).
 *
 * The popup is rendered via React portal with fixed positioning so it
 * escapes ancestor `overflow:hidden` containers and never gets clipped.
 *
 * Value contract matches native date input: ISO string "YYYY-MM-DD" (or "").
 */
export interface VnDatePickerProps {
  id?: string;
  value: string;                       // YYYY-MM-DD or ''
  onChange: (value: string) => void;   // called with YYYY-MM-DD or ''
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;                // default: dd/mm/yyyy
  className?: string;                  // applied to the trigger button
  min?: string;                        // YYYY-MM-DD
  max?: string;                        // YYYY-MM-DD
  name?: string;
}

const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

// Week starts on Monday (Vietnamese convention)
const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const POPUP_WIDTH = 288;   // matches w-72
const POPUP_HEIGHT = 340;  // approximate, used only for flip decision

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIso(value: string): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);
  const d = new Date(y, mo, da);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== da) return null;
  return d;
}

function formatDisplay(value: string): string {
  const d = parseIso(value);
  if (!d) return '';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Returns the Monday-based weekday index (0=Mon..6=Sun)
function mondayIndex(date: Date): number {
  const js = date.getDay(); // 0=Sun..6=Sat
  return (js + 6) % 7;
}

interface PopupPos {
  top: number;
  left: number;
}

export function VnDatePicker(props: VnDatePickerProps) {
  const {
    id, value, onChange, required, disabled,
    placeholder = 'dd/mm/yyyy', className, min, max, name,
  } = props;

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PopupPos>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  const today = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);

  const selectedDate = useMemo(() => parseIso(value), [value]);
  const minDate = useMemo(() => parseIso(min || ''), [min]);
  const maxDate = useMemo(() => parseIso(max || ''), [max]);

  // Currently displayed month
  const [viewYear, setViewYear] = useState<number>(() => (selectedDate ?? today).getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => (selectedDate ?? today).getMonth());

  // When opening, sync view to selected/today
  useEffect(() => {
    if (open) {
      const base = selectedDate ?? today;
      setViewYear(base.getFullYear());
      setViewMonth(base.getMonth());
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute popup position relative to trigger, flipping when near edges
  const computePosition = () => {
    const trig = triggerRef.current;
    if (!trig) return;
    const rect = trig.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    let left = rect.left;
    // Flip horizontally if it would overflow on the right
    if (left + POPUP_WIDTH + margin > vw) {
      left = Math.max(margin, rect.right - POPUP_WIDTH);
    }
    if (left < margin) left = margin;

    // Default: below the trigger
    let top = rect.bottom + 4;
    // Flip up if not enough room below and more room above
    if (top + POPUP_HEIGHT + margin > vh && rect.top - POPUP_HEIGHT - 4 > margin) {
      top = rect.top - POPUP_HEIGHT - 4;
    }
    setPos({ top, left });
  };

  // Position whenever the popup opens, and on resize/scroll while open
  useLayoutEffect(() => {
    if (!open) return;
    computePosition();
    const onScrollOrResize = () => computePosition();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true); // capture so nested scrolls update too
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open]);

  // Close on outside click / Esc
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      if (popupRef.current && popupRef.current.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startPad = mondayIndex(firstOfMonth);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // Build a 6x7 grid (42 cells) for stable height
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));
  while (cells.length < 42) cells.push(null);

  function isOutOfRange(d: Date): boolean {
    if (minDate && d < minDate) return true;
    if (maxDate && d > maxDate) return true;
    return false;
  }

  function pick(d: Date) {
    if (isOutOfRange(d)) return;
    onChange(toIso(d));
    setOpen(false);
  }

  function gotoPrevMonth() {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  }
  function gotoNextMonth() {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  }

  // Year selector range: ±15 years around current view
  const yearOptions = useMemo(() => {
    const base = viewYear;
    const arr: number[] = [];
    for (let y = base - 15; y <= base + 15; y++) arr.push(y);
    return arr;
  }, [viewYear]);

  const display = formatDisplay(value);

  const popup = open ? (
    <div
      ref={popupRef}
      role="dialog"
      aria-label="Chọn ngày"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: POPUP_WIDTH,
        zIndex: 9999,
      }}
      className="bg-white border border-slate-200 rounded-xl shadow-xl p-3"
    >
      {/* Header: month/year selectors + nav */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <select
            aria-label="Tháng"
            value={viewMonth}
            onChange={e => setViewMonth(Number(e.target.value))}
            className="text-sm font-medium px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select
            aria-label="Năm"
            value={viewYear}
            onChange={e => setViewYear(Number(e.target.value))}
            className="text-sm font-medium px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button" aria-label="Tháng trước" onClick={gotoPrevMonth}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button
            type="button" aria-label="Tháng sau" onClick={gotoNextMonth}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAY_LABELS.map((w, i) => (
          <div
            key={w}
            className={`text-center text-xs font-semibold py-1 ${i === 6 ? 'text-rose-500' : 'text-slate-500'}`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, idx) => {
          if (!d) return <div key={idx} className="h-8" />;
          const isToday = d.getTime() === today.getTime();
          const isSelected = selectedDate && d.getTime() === selectedDate.getTime();
          const disabledCell = isOutOfRange(d);
          const isSunday = d.getDay() === 0;
          return (
            <button
              key={idx}
              type="button"
              disabled={disabledCell}
              onClick={() => pick(d)}
              className={[
                'h-8 text-sm rounded-md transition-colors',
                disabledCell ? 'text-slate-300 cursor-not-allowed' :
                  isSelected ? 'bg-indigo-600 text-white font-semibold' :
                  isToday ? 'border border-indigo-400 text-indigo-600 hover:bg-indigo-50' :
                  isSunday ? 'text-rose-500 hover:bg-slate-100' :
                  'text-slate-700 hover:bg-slate-100',
              ].join(' ')}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={() => { onChange(''); setOpen(false); }}
          className="text-sm text-slate-500 hover:text-slate-700 px-2 py-1"
        >
          Xóa
        </button>
        <button
          type="button"
          onClick={() => pick(today)}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium px-2 py-1"
        >
          Hôm nay
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative">
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={
          className ??
          'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-left flex items-center justify-between gap-2'
        }
      >
        <span className={display ? 'text-slate-800' : 'text-slate-400'}>
          {display || placeholder}
        </span>
        <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>
      {required && !value && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value=""
          onChange={() => { /* noop */ }}
          className="sr-only"
          style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
        />
      )}
      {popup && createPortal(popup, document.body)}
    </div>
  );
}

export default VnDatePicker;

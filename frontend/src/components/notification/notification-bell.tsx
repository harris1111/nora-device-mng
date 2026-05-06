import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
} from '../../api/device-api';

const RELATIVE = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return 'vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  return `${d} ngày trước`;
};

export default function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try {
      const data = await getNotifications();
      setItems(data.items);
      setUnread(data.unread_count);
    } catch { /* silent — bell still functional after retry */ }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Subscribe to SSE stream. Cookie auth piggybacks via same-origin EventSource.
  useEffect(() => {
    const es = new EventSource('/api/notifications/stream', { withCredentials: true });
    es.addEventListener('notification', (ev) => {
      try {
        const n = JSON.parse((ev as MessageEvent).data) as NotificationItem;
        setItems(prev => [n, ...prev].slice(0, 30));
        if (!n.is_read) setUnread(c => c + 1);
      } catch { /* ignore malformed */ }
    });
    es.addEventListener('notification:read', () => { void refresh(); });
    es.addEventListener('notification:read-all', () => { setUnread(0); void refresh(); });
    es.onerror = () => { /* EventSource auto-reconnects */ };
    return () => es.close();
  }, [refresh]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const handleClickItem = async (n: NotificationItem) => {
    setOpen(false);
    if (!n.is_read) {
      try {
        const updated = await markNotificationRead(n.id);
        setItems(prev => prev.map(x => x.id === n.id ? updated : x));
        setUnread(c => Math.max(0, c - 1));
      } catch { /* still navigate */ }
    }
    if (n.link) navigate(n.link);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setItems(prev => prev.map(x => ({ ...x, is_read: true, read_at: new Date().toISOString() })));
      setUnread(0);
    } catch { /* noop */ }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="relative p-2 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
        aria-label="Thông báo"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white bg-red-500 border-2 border-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Thông báo</h3>
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Đánh dấu đã đọc
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">Chưa có thông báo</div>
            ) : (
              items.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClickItem(n)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 last:border-b-0 hover:bg-slate-50 transition-colors flex gap-3 ${
                    n.is_read ? 'bg-white' : 'bg-indigo-50/40'
                  }`}
                >
                  <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.is_read ? 'bg-transparent' : 'bg-indigo-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{RELATIVE(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

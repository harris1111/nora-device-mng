import { useState, useEffect, useCallback } from 'react';
import { getAuditLogs, type AuditLogItem, type AuditLogResponse } from '../api/audit-log-api';

const actionLabels: Record<string, string> = {
  login: 'Đăng nhập',
  user_create: 'Tạo tài khoản',
  user_update: 'Cập nhật tài khoản',
  user_delete: 'Xóa tài khoản',
  user_reset_password: 'Đặt lại mật khẩu',
  user_status_change: 'Thay đổi trạng thái',
  password_change: 'Đổi mật khẩu',
  permission_update: 'Cập nhật phân quyền',
};

export default function AuditLogPage() {
  const [data, setData] = useState<AuditLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try { setData(await getAuditLogs({ page, limit: 30 })); } catch { /* */ } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const formatMeta = (item: AuditLogItem) => {
    if (!item.metadata) return '';
    const entries = Object.entries(item.metadata).filter(([k]) => k !== 'permissions');
    if (!entries.length) return '';
    return entries.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ');
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-6">Nhật ký hệ thống</h1>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60">
                <th className="text-left px-5 py-3 font-semibold text-slate-600">Thời gian</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600">Người thực hiện</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600">Hành động</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600">Chi tiết</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto" /></td></tr>
              ) : data?.items.map(item => (
                <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                  <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{new Date(item.timestamp).toLocaleString('vi-VN')}</td>
                  <td className="px-5 py-3 font-medium text-slate-700">{item.actor?.username || '—'}</td>
                  <td className="px-5 py-3"><span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{actionLabels[item.action] || item.action}</span></td>
                  <td className="px-5 py-3 text-slate-500 max-w-xs truncate">{item.target_type ? `${item.target_type}` : ''}{formatMeta(item) ? ` · ${formatMeta(item)}` : ''}</td>
                  <td className="px-5 py-3 text-slate-400 font-mono text-xs">{item.ip || '—'}</td>
                </tr>
              ))}
              {!loading && (!data?.items.length) && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Không có nhật ký nào</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50/40">
            <span className="text-sm text-slate-500">Trang {data.page}/{data.pages} · Tổng {data.total} bản ghi</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-40 transition-colors">Trước</button>
              <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page >= data.pages} className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-40 transition-colors">Sau</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

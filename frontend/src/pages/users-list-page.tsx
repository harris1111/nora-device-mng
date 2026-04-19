import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getUsers, updateUserStatus, deleteUser, type UserItem } from '../api/user-api';
import { useAuth } from '../context/auth-context';
import { useCan } from '../hooks/use-permission';
import ConfirmDialog from '../components/ui/confirm-dialog';
import ResetPasswordModal from '../components/auth/reset-password-modal';

const roleBadge: Record<string, string> = {
  SADMIN: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-indigo-100 text-indigo-700',
  USER: 'bg-slate-100 text-slate-600',
};
const roleLabel: Record<string, string> = { SADMIN: 'Super Admin', ADMIN: 'Admin', USER: 'User' };
const statusBadge: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  LOCKED: 'bg-red-100 text-red-700',
};

export default function UsersListPage() {
  const { user: currentUser } = useAuth();
  const canCreate = useCan('users', 'create');
  const canUpdate = useCan('users', 'update');
  const canDelete = useCan('users', 'delete');

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{ type: 'delete' | 'status'; user: UserItem } | null>(null);
  const [resetModal, setResetModal] = useState<UserItem | null>(null);

  const fetchUsers = useCallback(async () => {
    try { setUsers(await getUsers()); } catch { /* handled by interceptor */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const canManage = (target: UserItem) => {
    if (target.role === 'SADMIN') return false;
    if (currentUser?.id === target.id) return false;
    if (currentUser?.role === 'SADMIN') return true;
    if (currentUser?.role === 'ADMIN' && target.role === 'USER') return true;
    return false;
  };

  const handleStatusToggle = async () => {
    if (!confirmDialog || confirmDialog.type !== 'status') return;
    const u = confirmDialog.user;
    const newStatus = u.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    setActionLoading(true);
    try {
      await updateUserStatus(u.id, newStatus);
      await fetchUsers();
      setConfirmDialog(null);
    } catch { /* noop */ } finally { setActionLoading(false); }
  };

  const handleDelete = async () => {
    if (!confirmDialog || confirmDialog.type !== 'delete') return;
    setActionLoading(true);
    try {
      await deleteUser(confirmDialog.user.id);
      await fetchUsers();
      setConfirmDialog(null);
    } catch { /* noop */ } finally { setActionLoading(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">Tài khoản</h1>
        {canCreate && (
          <Link to="/users/new" className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Thêm tài khoản
          </Link>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60">
                <th className="text-left px-5 py-3 font-semibold text-slate-600">Tài khoản</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600">Vai trò</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600">Đơn vị</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600">Trạng thái</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600">Ngày tạo</th>
                <th className="text-right px-5 py-3 font-semibold text-slate-600">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-800">{u.username}</td>
                  <td className="px-5 py-3"><span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${roleBadge[u.role] || ''}`}>{roleLabel[u.role] || u.role}</span></td>
                  <td className="px-5 py-3 text-slate-500 text-xs">
                    {u.assigned_locations && u.assigned_locations.length > 0
                      ? u.assigned_locations.map(l => l.name).join(', ')
                      : u.role === 'SADMIN' ? <span className="text-slate-300 italic">Tất cả</span> : <span className="text-slate-300 italic">Chưa gán</span>}
                  </td>
                  <td className="px-5 py-3"><span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge[u.status] || ''}`}>{u.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}</span></td>
                  <td className="px-5 py-3 text-slate-500">{new Date(u.created_at).toLocaleDateString('vi-VN')}</td>
                  <td className="px-5 py-3 text-right">
                    {canManage(u) && (
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate && (
                          <>
                            <Link to={`/users/${u.id}/edit`} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-indigo-50" title="Sửa">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </Link>
                            <button onClick={() => setResetModal(u)} className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors rounded-lg hover:bg-amber-50" title="Đặt lại mật khẩu">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                            </button>
                            <button onClick={() => setConfirmDialog({ type: 'status', user: u })} className={`p-1.5 transition-colors rounded-lg ${u.status === 'ACTIVE' ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-green-600 hover:bg-green-50'}`} title={u.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa'}>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={u.status === 'ACTIVE' ? 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' : 'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z'} /></svg>
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <button onClick={() => setConfirmDialog({ type: 'delete', user: u })} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50" title="Xóa">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">Không có tài khoản nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmDialog?.type === 'delete' && (
        <ConfirmDialog
          isOpen
          title="Xóa tài khoản"
          message={<>Bạn có chắc chắn muốn xóa tài khoản <strong>{confirmDialog.user.username}</strong>?</>}
          confirmLabel="Xóa"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDialog(null)}
          loading={actionLoading}
        />
      )}

      {confirmDialog?.type === 'status' && (
        <ConfirmDialog
          isOpen
          title={confirmDialog.user.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
          message={<>Bạn có muốn {confirmDialog.user.status === 'ACTIVE' ? 'khóa' : 'mở khóa'} tài khoản <strong>{confirmDialog.user.username}</strong>?</>}
          confirmLabel={confirmDialog.user.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'}
          variant="warning"
          onConfirm={handleStatusToggle}
          onCancel={() => setConfirmDialog(null)}
          loading={actionLoading}
        />
      )}

      {resetModal && (
        <ResetPasswordModal
          isOpen
          userId={resetModal.id}
          username={resetModal.username}
          onClose={() => setResetModal(null)}
          onSuccess={fetchUsers}
        />
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { getPermissions, updateRolePermissions, type PermissionMatrix } from '../api/permission-api';
import { useAuth } from '../context/auth-context';
import { useCan } from '../hooks/use-permission';

const ROLES = ['SADMIN', 'ADMIN', 'USER'] as const;
const MODULES = ['devices', 'locations', 'maintenance', 'attachments', 'transfer', 'users', 'permissions'] as const;
const ACTIONS = ['canView', 'canCreate', 'canUpdate', 'canDelete'] as const;
const actionLabels: Record<string, string> = { canView: 'Xem', canCreate: 'Tạo', canUpdate: 'Sửa', canDelete: 'Xóa' };
const moduleLabels: Record<string, string> = { devices: 'Thiết bị', locations: 'Đơn vị', maintenance: 'Bảo trì', attachments: 'Tệp đính kèm', transfer: 'Luân chuyển', users: 'Tài khoản', permissions: 'Phân quyền' };
const roleLabels: Record<string, string> = { SADMIN: 'Super Admin', ADMIN: 'Admin', USER: 'User' };

export default function PermissionDashboardPage() {
  const { user } = useAuth();
  const canUpdate = useCan('permissions', 'update');
  const [matrix, setMatrix] = useState<PermissionMatrix>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  const fetchMatrix = useCallback(async () => {
    try { setMatrix(await getPermissions()); } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMatrix(); }, [fetchMatrix]);

  const canEditRole = (role: string) => {
    if (!canUpdate) return false;
    if (role === 'SADMIN') return false;
    if (user?.role === 'SADMIN') return true;
    if (user?.role === 'ADMIN' && role === 'USER') return true;
    return false;
  };

  const togglePermission = (role: string, mod: string, action: string) => {
    if (!canEditRole(role)) return;
    setMatrix(prev => {
      const updated = { ...prev };
      const current = updated[role]?.[mod] || { canView: false, canCreate: false, canUpdate: false, canDelete: false };
      updated[role] = { ...updated[role], [mod]: { ...current, [action]: !current[action as keyof typeof current] } };
      return updated;
    });
    setDirty(prev => ({ ...prev, [role]: true }));
  };

  const saveRole = async (role: string) => {
    setSaving(role);
    try {
      const modules: Record<string, { canView?: boolean; canCreate?: boolean; canUpdate?: boolean; canDelete?: boolean }> = {};
      const rolePerms = matrix[role];
      if (rolePerms) {
        for (const [mod, perms] of Object.entries(rolePerms)) {
          modules[mod] = perms;
        }
      }
      await updateRolePermissions(role, modules);
      setDirty(prev => ({ ...prev, [role]: false }));
    } catch { /* */ } finally { setSaving(null); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-6">Phân quyền</h1>

      {ROLES.map(role => (
        <div key={role} className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-700">{roleLabels[role]}</h2>
            {canEditRole(role) && dirty[role] && (
              <button onClick={() => saveRole(role)} disabled={saving === role} className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50">
                {saving === role ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60">
                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Module</th>
                    {ACTIONS.map(a => <th key={a} className="text-center px-4 py-3 font-semibold text-slate-600">{actionLabels[a]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map(mod => {
                    const perms = matrix[role]?.[mod] || { canView: false, canCreate: false, canUpdate: false, canDelete: false };
                    return (
                      <tr key={mod} className="border-b border-slate-100 last:border-0">
                        <td className="px-5 py-3 font-medium text-slate-700">{moduleLabels[mod] || mod}</td>
                        {ACTIONS.map(action => (
                          <td key={action} className="text-center px-4 py-3">
                            <button
                              onClick={() => togglePermission(role, mod, action)}
                              disabled={!canEditRole(role)}
                              className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                                perms[action as keyof typeof perms]
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'border-slate-300 hover:border-indigo-400'
                              } ${!canEditRole(role) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                            >
                              {perms[action as keyof typeof perms] && (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                              )}
                            </button>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

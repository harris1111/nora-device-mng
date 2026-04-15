import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createUser, getUser, updateUser } from '../api/user-api';
import { useAuth } from '../context/auth-context';

export default function UserFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('USER');
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEdit);
  const [error, setError] = useState('');

  const roleOptions = currentUser?.role === 'SADMIN'
    ? [{ value: 'ADMIN', label: 'Admin' }, { value: 'USER', label: 'User' }]
    : [{ value: 'USER', label: 'User' }];

  useEffect(() => {
    if (isEdit && id) {
      getUser(id)
        .then(u => { setUsername(u.username); setRole(u.role); })
        .catch(() => navigate('/users'))
        .finally(() => setFetchLoading(false));
    }
  }, [id, isEdit, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('Vui lòng nhập tên đăng nhập'); return; }
    if (!isEdit && !password.trim()) { setError('Vui lòng nhập mật khẩu'); return; }
    if (!isEdit && password.length < 6) { setError('Mật khẩu phải có ít nhất 6 ký tự'); return; }
    setLoading(true);
    try {
      if (isEdit && id) {
        await updateUser(id, { username });
      } else {
        await createUser({ username, password, role });
      }
      navigate('/users');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (msg === 'Username already exists') setError('Tên đăng nhập đã tồn tại');
      else setError(msg || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-slate-800 mb-6">{isEdit ? 'Sửa tài khoản' : 'Thêm tài khoản'}</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Tên đăng nhập</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm" autoFocus />
        </div>

        {!isEdit && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mật khẩu</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Vai trò</label>
              <select value={role} onChange={e => setRole(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white">
                {roleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate('/users')} className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">Hủy</button>
          <button type="submit" disabled={loading} className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50">
            {loading ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo tài khoản'}
          </button>
        </div>
      </form>
    </div>
  );
}

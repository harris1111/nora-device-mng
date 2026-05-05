import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleHome = () => {
    if (isAuthenticated) navigate('/devices');
    else navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <div className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full mb-4 tracking-widest">
          404
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-2">Trang không tồn tại</h1>
        <p className="text-slate-500 text-sm mb-8">
          Đường dẫn bạn truy cập không tồn tại hoặc đã bị di chuyển.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={handleHome}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            {isAuthenticated ? 'Về trang chủ' : 'Đến trang đăng nhập'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
          >
            Quay lại
          </button>
        </div>
      </div>
    </div>
  );
}

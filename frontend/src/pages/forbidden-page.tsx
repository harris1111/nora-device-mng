import { useNavigate } from 'react-router-dom';

export default function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] px-4">
      <div className="w-full max-w-md text-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        <div className="inline-flex items-center px-3 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded-full mb-4 border border-red-200">
          Lỗi 403
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-2">Không có quyền truy cập</h1>
        <p className="text-slate-500 text-sm mb-8">
          Bạn không có quyền xem trang này. Vui lòng liên hệ quản trị viên nếu bạn cần hỗ trợ.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => navigate('/devices')}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Về trang chủ
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

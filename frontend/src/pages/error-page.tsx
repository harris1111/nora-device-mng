interface Props {
  onReset?: () => void;
}

export default function ErrorPage({ onReset }: Props) {
  const handleReload = () => {
    if (onReset) onReset();
    window.location.reload();
  };

  const handleHome = () => {
    window.location.href = '/devices';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-100">
          <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <div className="inline-flex items-center px-3 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-full mb-4 tracking-widest border border-red-100">
          500
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-2">Đã xảy ra lỗi</h1>
        <p className="text-slate-500 text-sm mb-8">
          Có lỗi không mong muốn xảy ra. Vui lòng thử tải lại trang hoặc quay về trang chủ.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={handleReload}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Tải lại trang
          </button>
          <button
            type="button"
            onClick={handleHome}
            className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
          >
            Về trang chủ
          </button>
        </div>
      </div>
    </div>
  );
}

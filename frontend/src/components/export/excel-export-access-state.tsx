export function ExcelExportDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-500">
      <svg className="mb-3 h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" /></svg>
      <p className="text-lg font-medium">Bạn không có quyền xuất Excel</p>
      <p className="mt-1 text-sm">Liên hệ quản trị viên để được cấp quyền.</p>
    </div>
  );
}

export function ExcelExportLoading() {
  return <div className="mx-auto mt-20 h-9 w-9 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />;
}

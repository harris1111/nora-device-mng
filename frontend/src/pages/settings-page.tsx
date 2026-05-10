import { useEffect, useState, type FormEvent } from 'react';
import {
  getSettingsApi,
  updateBaseUrlApi,
  regenerateQrCodesApi,
} from '../api/settings-api';

type Feedback = { type: 'success' | 'error'; message: string } | null;

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [currentBaseUrl, setCurrentBaseUrl] = useState('');
  const [draftBaseUrl, setDraftBaseUrl] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);
  const [urlFeedback, setUrlFeedback] = useState<Feedback>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenFeedback, setRegenFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getSettingsApi();
        if (!alive) return;
        setCurrentBaseUrl(data.base_url);
        setDraftBaseUrl(data.base_url);
      } catch {
        if (alive) setUrlFeedback({ type: 'error', message: 'Không tải được cấu hình' });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleSaveUrl = async (e: FormEvent) => {
    e.preventDefault();
    setUrlFeedback(null);
    const trimmed = draftBaseUrl.trim();
    if (!trimmed) {
      setUrlFeedback({ type: 'error', message: 'Vui lòng nhập domain' });
      return;
    }
    try {
      new URL(trimmed);
    } catch {
      setUrlFeedback({ type: 'error', message: 'Domain không hợp lệ (ví dụ: https://example.com)' });
      return;
    }
    if (!/^https?:/i.test(trimmed)) {
      setUrlFeedback({ type: 'error', message: 'Domain phải bắt đầu bằng http:// hoặc https://' });
      return;
    }

    setSavingUrl(true);
    try {
      const data = await updateBaseUrlApi(trimmed);
      setCurrentBaseUrl(data.base_url);
      setDraftBaseUrl(data.base_url);
      setUrlFeedback({ type: 'success', message: 'Đã lưu domain mới' });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Lưu thất bại';
      setUrlFeedback({ type: 'error', message: msg });
    } finally {
      setSavingUrl(false);
    }
  };

  const handleRegenerate = async () => {
    setConfirmOpen(false);
    setRegenFeedback(null);
    setRegenerating(true);
    try {
      const data = await regenerateQrCodesApi();
      setRegenFeedback({
        type: 'success',
        message: `Đã tạo lại ${data.updated} mã QR theo domain ${data.base_url}`,
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Tạo lại mã QR thất bại';
      setRegenFeedback({ type: 'error', message: msg });
    } finally {
      setRegenerating(false);
    }
  };

  const dirty = draftBaseUrl.trim() !== currentBaseUrl;

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold text-slate-800">Cài đặt hệ thống</h1>

      {/* Base URL card */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Domain công khai</h2>
          <p className="mt-1 text-sm text-slate-500">
            Domain này được dùng để tạo URL trong mã QR của thiết bị (
            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              {currentBaseUrl || '...'}/public/device/&#123;id&#125;
            </code>
            ).
          </p>
        </div>
        <form onSubmit={handleSaveUrl} className="px-6 py-5 space-y-4">
          {loading ? (
            <div className="h-10 bg-slate-100 animate-pulse rounded-xl" />
          ) : (
            <>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Domain</span>
                <input
                  type="url"
                  value={draftBaseUrl}
                  onChange={(e) => setDraftBaseUrl(e.target.value)}
                  placeholder="https://devices.example.com"
                  className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  disabled={savingUrl}
                />
              </label>
              {urlFeedback && (
                <div
                  className={`text-sm rounded-lg px-3 py-2 ${
                    urlFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {urlFeedback.message}
                </div>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingUrl || !dirty}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingUrl ? 'Đang lưu...' : 'Lưu domain'}
                </button>
              </div>
            </>
          )}
        </form>
      </section>

      {/* Regenerate QR codes card */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Tạo lại tất cả mã QR</h2>
          <p className="mt-1 text-sm text-slate-500">
            Tạo lại mã QR cho toàn bộ thiết bị theo domain hiện tại. Sử dụng khi vừa thay đổi domain
            ở trên. Mã QR cũ trên các bản in thực tế sẽ vẫn trỏ về domain cũ — bạn cần in lại.
          </p>
        </div>
        <div className="px-6 py-5 space-y-4">
          {regenFeedback && (
            <div
              className={`text-sm rounded-lg px-3 py-2 ${
                regenFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {regenFeedback.message}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={regenerating || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {regenerating ? 'Đang tạo lại...' : 'Tạo lại tất cả mã QR'}
            </button>
          </div>
        </div>
      </section>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800">Xác nhận tạo lại mã QR</h3>
            <p className="mt-2 text-sm text-slate-600">
              Hành động này sẽ tạo lại mã QR cho toàn bộ thiết bị theo domain{' '}
              <strong className="text-slate-800">{currentBaseUrl}</strong>. Quá trình có thể mất vài
              phút nếu hệ thống có nhiều thiết bị. Bạn có muốn tiếp tục?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleRegenerate}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
              >
                Tạo lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

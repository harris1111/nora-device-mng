import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getDevice, deleteDevice, deviceImageUrl } from '../api/device-api';
import QrcodeDisplay from '../components/qrcode-display';
import PrintQrcodeButton from '../components/print-qrcode-button';
import TransferForm from '../components/transfer-form';
import TransferHistory from '../components/transfer-history';

export default function DeviceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transferRefresh, setTransferRefresh] = useState(0);

  useEffect(() => {
    getDevice(id)
      .then(setDevice)
      .catch(() => setError('Không tìm thấy thiết bị'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm(`Xử lý không thể hoàn tác. Bạn chắc chắn muốn xóa "${device.name}"?`)) return;
    try {
      await deleteDevice(id);
      navigate('/devices');
    } catch {
      setError('Không thể xóa thiết bị');
    }
  };

  const handleTransferred = (updatedDevice) => {
    setDevice(updatedDevice);
    setTransferRefresh((n) => n + 1);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="h-10 w-32 bg-slate-200 rounded-lg"></div>
        <div className="card-glass p-8">
          <div className="h-64 bg-slate-200 rounded-xl mb-6"></div>
          <div className="h-8 w-1/2 bg-slate-200 rounded mb-4"></div>
          <div className="h-4 w-1/3 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {error}
        </div>
      </div>
    );
  }

  const infoFields = [
    { label: 'Đang sử dụng bởi', value: device.owned_by ? `${device.location_name ? device.location_name + ' → ' : ''}${device.owned_by}` : null },
    { label: 'Số serial', value: device.serial_number },
    { label: 'Nhà sản xuất', value: device.manufacturer },
    { label: 'Model', value: device.model },
  ].filter((f) => f.value);

  return (
    <div className="max-w-4xl mx-auto pb-12 space-y-6">
      {/* Top bar */}
      <div className="flex justify-between items-center hidden md:flex">
        <Link to="/devices" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">
          <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Quay lại danh sách
        </Link>
        <div className="flex gap-3">
          <Link to={`/devices/${device.id}/edit`}
            className="inline-flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 text-sm font-semibold rounded-lg hover:bg-indigo-100 transition-colors">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Chỉnh sửa
          </Link>
          <button onClick={handleDelete}
            className="inline-flex items-center px-4 py-2 bg-white border border-red-200 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-50 focus:ring-4 focus:ring-red-100 transition-all">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Xóa thiết bị
          </button>
        </div>
      </div>

      {/* Main card */}
      <div className="card-glass border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        <div className="md:flex">
          {/* Left Column (Image) */}
          <div className="md:w-5/12 bg-slate-50 relative border-b md:border-b-0 md:border-r border-slate-100">
            {device.image_mime ? (
              <div className="aspect-square md:aspect-auto md:h-full w-full relative">
                <img src={deviceImageUrl(device.id)} alt={device.name} className="absolute inset-0 w-full h-full object-cover" />
              </div>
            ) : (
              <div className="aspect-square md:aspect-auto md:h-full w-full flex flex-col items-center justify-center text-slate-300 min-h-[280px]">
                <svg className="w-20 h-20 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium">Không có hình ảnh</span>
              </div>
            )}
            {/* Mobile Actions */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 md:hidden">
              <Link to={`/devices/${device.id}/edit`} className="w-10 h-10 bg-white/90 backdrop-blur rounded-full shadow-md flex items-center justify-center text-indigo-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </Link>
              <button onClick={handleDelete} className="w-10 h-10 bg-white/90 backdrop-blur rounded-full shadow-md flex items-center justify-center text-red-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>

          {/* Right Column (Details) */}
          <div className="md:w-7/12 p-6 md:p-8 flex flex-col">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex px-2.5 py-1 rounded border border-slate-200 bg-slate-50 text-slate-600 font-mono text-xs font-semibold shadow-sm">
                {device.store_id}
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                {device.location_name ? (
                  <><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-1.5"></div>{device.location_name}</>
                ) : 'Chưa xếp vị trí'}
              </span>
            </div>

            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight leading-tight mb-4">
              {device.name}
            </h1>

            <p className="text-sm text-slate-500 mb-6 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Đã tạo vào lúc {new Date(device.created_at + 'Z').toLocaleString('vi-VN')}
            </p>

            {/* Device info fields */}
            {infoFields.length > 0 && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6 pb-6 border-b border-slate-100">
                {infoFields.map((f) => (
                  <div key={f.label}>
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{f.label}</p>
                    <p className="text-sm font-semibold text-slate-700 mt-0.5">{f.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Description */}
            {device.description && (
              <div className="mb-6 pb-6 border-b border-slate-100">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Ghi chú</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{device.description}</p>
              </div>
            )}

            {/* QR Section */}
            <div className="mt-auto bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col sm:flex-row items-center gap-6">
              <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 shrink-0">
                <QrcodeDisplay deviceId={device.id} className="w-32 h-32" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-lg font-bold text-slate-800 mb-2">Mã truy cập nhanh</h3>
                <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                  Dán mã QR này lên thiết bị vật lý để quét bằng điện thoại và mở nhanh trang chi tiết công khai.
                </p>
                <PrintQrcodeButton deviceId={device.id} storeId={device.store_id} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transfer section */}
      <div className="card-glass border border-slate-100 shadow-sm p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Chuyển giao & Lịch sử
          </h2>
        </div>

        <TransferForm
          deviceId={device.id}
          currentOwner={device.owned_by}
          onTransferred={handleTransferred}
        />

        <TransferHistory deviceId={device.id} refreshKey={transferRefresh} />
      </div>
    </div>
  );
}

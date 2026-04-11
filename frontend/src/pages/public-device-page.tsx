import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicDevice, attachmentFileUrl, PublicDevice } from '../api/device-api';
import { getTypeName, getStatusInfo } from '../components/device-constants';

export default function PublicDevicePage() {
  const { id } = useParams();
  const [device, setDevice] = useState<PublicDevice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPublicDevice(id)
      .then(setDevice)
      .catch(() => setError('Không tìm thấy thiết bị'));
  }, [id]);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-red-500 text-xl">{error}</p>
    </div>
  );

  if (!device) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Đang tải...</p>
    </div>
  );

  const statusInfo = getStatusInfo(device.status);
  const primaryImage = device.attachments?.find(a => a.is_primary);
  const primaryUrl = primaryImage ? attachmentFileUrl(primaryImage.id) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-slate-800 mb-1">{device.name}</h1>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{device.store_id}</span>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border bg-${statusInfo.color === 'emerald' ? 'emerald' : statusInfo.color === 'amber' ? 'amber' : statusInfo.color === 'red' ? 'red' : 'slate'}-50 text-${statusInfo.color === 'emerald' ? 'emerald' : statusInfo.color === 'amber' ? 'amber' : statusInfo.color === 'red' ? 'red' : 'slate'}-700 border-${statusInfo.color === 'emerald' ? 'emerald' : statusInfo.color === 'amber' ? 'amber' : statusInfo.color === 'red' ? 'red' : 'slate'}-200`}>
              {statusInfo.label}
            </span>
          </div>
        </div>

        {/* Primary image */}
        {primaryUrl && (
          <div className="rounded-2xl overflow-hidden shadow-md border border-slate-100">
            <img src={primaryUrl} alt={device.name} className="w-full aspect-video object-cover" />
          </div>
        )}

        {/* Info card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase">Loại</p>
              <p className="font-semibold text-slate-700">{getTypeName(device.type)}</p>
            </div>
            {device.location_name && (
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase">Vị trí</p>
                <p className="font-semibold text-slate-700">{device.location_name}</p>
              </div>
            )}
            {device.owned_by && (
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase">Đang sử dụng</p>
                <p className="font-semibold text-slate-700">{device.owned_by}</p>
              </div>
            )}
            {device.serial_number && (
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase">Số serial</p>
                <p className="font-semibold text-slate-700 font-mono">{device.serial_number}</p>
              </div>
            )}
            {device.manufacturer && (
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase">Nhà sản xuất</p>
                <p className="font-semibold text-slate-700">{device.manufacturer}</p>
              </div>
            )}
            {device.model && (
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase">Model</p>
                <p className="font-semibold text-slate-700">{device.model}</p>
              </div>
            )}
            {device.transfer_to && (
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase">Chuyển giao cho</p>
                <p className="font-semibold text-slate-700">{device.transfer_to}</p>
              </div>
            )}
            {device.transfer_date && (
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase">Ngày chuyển giao</p>
                <p className="font-semibold text-slate-700">{new Date(device.transfer_date).toLocaleDateString('vi-VN')}</p>
              </div>
            )}
          </div>
          {device.description && (
            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400 font-medium uppercase mb-1">Ghi chú</p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{device.description}</p>
            </div>
          )}
        </div>

        {/* Attachment gallery (read only) */}
        {device.attachments?.length > 1 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Hình ảnh</h2>
            <div className="grid grid-cols-3 gap-2">
              {device.attachments.filter(a => a.file_type?.startsWith('image/')).map(a => (
                <a key={a.id} href={attachmentFileUrl(a.id)} target="_blank" rel="noopener noreferrer"
                  className="rounded-xl overflow-hidden border border-slate-100 hover:shadow-md transition-shadow">
                  <img src={attachmentFileUrl(a.id)} alt={a.file_name} className="w-full aspect-square object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Maintenance timeline (read only, tai_san only) */}
        {device.maintenance_records?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Lịch sử bảo trì</h2>
            <div className="space-y-0">
              {device.maintenance_records.map((r, i) => (
                <div key={r.id} className="relative pl-7 pb-4 last:pb-0">
                  {i < device.maintenance_records.length - 1 && (
                    <div className="absolute left-[9px] top-5 bottom-0 w-0.5 bg-slate-200"></div>
                  )}
                  <div className="absolute left-0 top-0.5 w-5 h-5 rounded-full bg-blue-100 border-2 border-blue-400 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{r.description}</p>
                    <div className="flex flex-wrap gap-x-3 mt-1 text-xs text-slate-400">
                      <span>{new Date(r.date).toLocaleDateString('vi-VN')}</span>
                      {r.performed_by && <span>bởi {r.performed_by}</span>}
                      {r.cost != null && <span>{Number(r.cost).toLocaleString('vi-VN')} đ</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 pb-4">
          Nora Device Manager
        </p>
      </div>
    </div>
  );
}

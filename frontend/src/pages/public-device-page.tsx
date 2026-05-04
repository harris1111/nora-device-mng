import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPublicDevice, publicAttachmentFileUrl, publicTransferAttachmentFileUrl, publicMaintenanceAttachmentFileUrl, PublicDevice } from '../api/device-api';
import { getTypeName, getStatusInfo } from '../components/device/device-constants';
import AttachmentList from '../components/attachment/attachment-list';
import TransferInfoSection from '../components/transfer/transfer-info-section';
import LoginModal from '../components/auth/login-modal';
import { useAuth } from '../context/auth-context';
import { useCan } from '../hooks/use-permission';

export default function PublicDevicePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const canEdit = useCan('devices', 'update');
  const [device, setDevice] = useState<PublicDevice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    getPublicDevice(id)
      .then(setDevice)
      .catch(() => setError('Không tìm thấy thiết bị'));
  }, [id]);

  // Auto-redirect authenticated users with edit permission to the edit page.
  useEffect(() => {
    if (!authLoading && isAuthenticated && canEdit && id) {
      navigate(`/devices/${id}/edit`, { replace: true });
    }
  }, [authLoading, isAuthenticated, canEdit, id, navigate]);

  // After a login attempt inside the modal, react to the new auth state.
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      if (canEdit) {
        setLoginOpen(false);
      } else {
        setPermissionError('Tài khoản không có quyền chỉnh sửa thiết bị');
      }
    }
  }, [authLoading, isAuthenticated, canEdit]);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-red-500 text-xl">{error}</p>
    </div>
  );

  if (!device || authLoading || (isAuthenticated && canEdit)) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Đang tải...</p>
    </div>
  );

  const statusInfo = getStatusInfo(device.status);
  const primaryImage = device.attachments?.find(a => a.is_primary);
  const primaryUrl = primaryImage ? publicAttachmentFileUrl(primaryImage.id) : null;

  return (
    <>
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
                <p className="text-xs text-slate-400 font-medium uppercase">Đơn vị trực thuộc</p>
                <p className="font-semibold text-slate-700">{device.location_name}</p>
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
          </div>
          {device.description && (
            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400 font-medium uppercase mb-1">Ghi chú</p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{device.description}</p>
            </div>
          )}
        </div>

        <TransferInfoSection transfer={device.transfer_record} compact fileUrlResolver={(a) => publicTransferAttachmentFileUrl(a.id)} />

        {/* Attachments (read only) */}
        {device.attachments?.length > 1 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Tệp đính kèm</h2>
            <AttachmentList attachments={device.attachments} fileUrlResolver={(a) => publicAttachmentFileUrl(a.id)} />
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
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{r.description}</p>
                    <div className="flex flex-wrap gap-x-3 mt-1 text-xs text-slate-400">
                      <span>{new Date(r.date).toLocaleDateString('vi-VN')}</span>
                      {r.technician && <span>bởi {r.technician}</span>}
                    </div>
                    {r.attachments?.length > 0 && (
                      <div className="mt-2">
                        <AttachmentList attachments={r.attachments} maintenanceMode fileUrlResolver={(a) => publicMaintenanceAttachmentFileUrl(a.id)} />
                      </div>
                    )}
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
    <LoginModal
      open={loginOpen}
      onClose={() => { setLoginOpen(false); setPermissionError(null); }}
      extraError={permissionError}
    />
    </>
  );
}

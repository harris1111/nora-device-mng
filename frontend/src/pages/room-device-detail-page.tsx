import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getDevice, deleteDevice, getAttachments, uploadAttachments, deleteAttachment, setAttachmentPrimary, attachmentFileUrl, getMaintenanceRecords, getInventoryRecords, uploadTransferAttachments, deleteTransferAttachment, Device, Attachment, MaintenanceRecord, InventoryRecord } from '../api/device-api';
import { getRoomDetail, type RoomNodeSummary } from '../api/room-api';
import QrcodeDisplay from '../components/qrcode/qrcode-display';
import PrintQrcodeButton from '../components/qrcode/print-qrcode-button';
import DeviceStatusBadge from '../components/device/device-status-badge';
import AttachmentList from '../components/attachment/attachment-list';
import MaintenanceHistory from '../components/maintenance/maintenance-history';
import MaintenanceSection from '../components/maintenance/maintenance-section';
import InventoryHistory from '../components/inventory/inventory-history';
import InventorySection from '../components/inventory/inventory-section';
import TransferInfoSection from '../components/transfer/transfer-info-section';
import { getTypeName } from '../components/device/device-constants';

export default function RoomDeviceDetailPage() {
  const { roomId, deviceId } = useParams<{ roomId: string; deviceId: string }>();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [room, setRoom] = useState<RoomNodeSummary | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [inventoryRecords, setInventoryRecords] = useState<InventoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [transferUploading, setTransferUploading] = useState(false);

  const loadDevice = useCallback(() => getDevice(deviceId).then(setDevice), [deviceId]);
  const loadAttachments = useCallback(() => getAttachments(deviceId!).then(setAttachments).catch(() => setAttachments([])), [deviceId]);
  const loadMaintenance = useCallback(() => getMaintenanceRecords(deviceId!).then(setMaintenanceRecords).catch(() => setMaintenanceRecords([])), [deviceId]);
  const loadInventory = useCallback(() => getInventoryRecords(deviceId!).then(setInventoryRecords).catch(() => setInventoryRecords([])), [deviceId]);

  useEffect(() => {
    if (!roomId || !deviceId) return;
    getRoomDetail(roomId).then(setRoom).catch(() => {});
    Promise.all([loadDevice(), loadAttachments(), loadMaintenance(), loadInventory()])
      .catch(() => setError('Không tìm thấy thiết bị'))
      .finally(() => setLoading(false));
  }, [roomId, deviceId, loadDevice, loadAttachments, loadMaintenance, loadInventory]);

  const handleDelete = async () => {
    if (!device || !window.confirm(`Xóa "${device.name}"?`)) return;
    try {
      await deleteDevice(device.id);
      navigate(`/rooms/${roomId}`);
    } catch { setError('Không thể xóa thiết bị'); }
  };

  const handleDeleteAttachment = async (attachmentId: string) => { try { await deleteAttachment(attachmentId); loadAttachments(); loadDevice(); } catch { setError('Không thể xóa tệp'); } };
  const handleSetPrimary = async (attachmentId: string) => { try { await setAttachmentPrimary(attachmentId); loadAttachments(); loadDevice(); } catch { setError('Không thể đặt ảnh chính'); } };
  const handleUploadAttachments = async (files: File[]) => { setUploading(true); try { await uploadAttachments(device!.id, files); loadAttachments(); loadDevice(); } catch { setError('Không thể tải lên tệp'); } finally { setUploading(false); } };
  const handleDeleteTransferAttachment = async (attachmentId: string) => { try { await deleteTransferAttachment(attachmentId); loadDevice(); } catch { setError('Không thể xóa tệp chuyển giao'); } };
  const handleUploadTransferFiles = async (files: File[]) => { if (!device) return; setTransferUploading(true); try { await uploadTransferAttachments(device.id, files); loadDevice(); } catch { setError('Không thể tải lên tệp chuyển giao'); } finally { setTransferUploading(false); } };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  if (error) return <div className="max-w-4xl mx-auto"><div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100">{error}</div></div>;
  if (!device) return null;

  const primaryAttachment = attachments.find(a => a.is_primary);
  const primaryImageUrl = primaryAttachment ? attachmentFileUrl(primaryAttachment.id) : null;
  const backUrl = `/rooms/${roomId}`;

  return (
    <div className="max-w-4xl mx-auto pb-12 space-y-6">
      <div className="hidden md:flex justify-between items-center">
        <Link to={backUrl} className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">
          <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Quay lại {room?.name || 'phòng'}
        </Link>
        <div className="flex gap-3">
          <Link to={`/rooms/${roomId}/devices/${device.id}/edit`} className="inline-flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 text-sm font-semibold rounded-lg hover:bg-indigo-100">Sửa</Link>
          <button onClick={handleDelete} className="inline-flex items-center px-4 py-2 bg-white border border-red-200 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-50">Xóa</button>
        </div>
      </div>

      <div className="card-glass border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        <div className="md:flex">
          <div className="md:w-5/12 bg-slate-50 relative border-b md:border-b-0 md:border-r border-slate-100">
            {primaryImageUrl ? (
              <div className="aspect-square md:aspect-auto md:h-full w-full relative"><img src={primaryImageUrl} alt={device.name} className="absolute inset-0 w-full h-full object-cover" /></div>
            ) : (
              <div className="aspect-square md:aspect-auto md:h-full w-full flex flex-col items-center justify-center text-slate-300 min-h-[280px]">
                <svg className="w-20 h-20 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="text-sm font-medium">Không có hình ảnh</span>
              </div>
            )}
          </div>
          <div className="md:w-7/12 p-6 md:p-8 flex flex-col">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex px-2.5 py-1 rounded border border-slate-200 bg-slate-50 text-slate-600 font-mono text-xs font-semibold shadow-sm">{device.store_id}</span>
              <DeviceStatusBadge status={device.status} />
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">{device.location_name || 'Chưa gán'}</span>
              {device.area_name && <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">{device.area_name}</span>}
              {room && <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100">{room.name}</span>}
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight leading-tight mb-4">{device.name}</h1>
            <p className="text-sm text-slate-500 mb-6">Đã tạo vào lúc {new Date(device.created_at).toLocaleString('vi-VN')}</p>
            {device.description && (
              <div className="mb-6 pb-6 border-b border-slate-100">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Ghi chú</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{device.description}</p>
              </div>
            )}
            <div className="mt-auto bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col sm:flex-row items-center gap-6">
              <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 shrink-0"><QrcodeDisplay deviceId={device.id} className="w-32 h-32" /></div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-lg font-bold text-slate-800 mb-2">Mã truy cập nhanh</h3>
                <p className="text-sm text-slate-500 mb-4">Dán mã QR này lên thiết bị vật lý để quét bằng điện thoại.</p>
                <PrintQrcodeButton deviceId={device.id} storeId={device.store_id} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <TransferInfoSection transfer={device.transfer_record} onUpload={handleUploadTransferFiles} onDeleteAttachment={handleDeleteTransferAttachment} uploading={transferUploading} />

      <div className="card-glass border border-slate-100 shadow-sm p-6 md:p-8 space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Tệp đính kèm ({attachments.length})</h2>
        <AttachmentList attachments={attachments} onDelete={handleDeleteAttachment} onSetPrimary={handleSetPrimary} onUpload={handleUploadAttachments} uploading={uploading} maxFiles={10} allowUpload />
      </div>

      {device.type === 'tai_san' && (
        <MaintenanceSection deviceId={device.id} maintenanceStatus={device.maintenance_status} onChange={loadDevice} />
      )}
      {device.type === 'tai_san' && (
        <div className="card-glass border border-slate-100 shadow-sm p-6 md:p-8 space-y-4">
          <h2 className="text-lg font-bold text-slate-800">Lịch sử sửa chữa ({maintenanceRecords.length})</h2>
          <MaintenanceHistory deviceId={device.id} records={maintenanceRecords} onUpdate={() => { loadMaintenance(); loadDevice(); }} />
        </div>
      )}
      {device.type === 'tai_san' && (
        <InventorySection deviceId={device.id} inventoryStatus={device.inventory_status} onChange={loadDevice} />
      )}
      {device.type === 'tai_san' && (
        <div className="card-glass border border-slate-100 shadow-sm p-6 md:p-8 space-y-4">
          <h2 className="text-lg font-bold text-slate-800">Lịch sử kiểm kê ({inventoryRecords.length})</h2>
          <InventoryHistory deviceId={device.id} records={inventoryRecords} onUpdate={() => { loadInventory(); loadDevice(); }} />
        </div>
      )}
    </div>
  );
}

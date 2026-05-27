import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getDevice, updateDevice, getAttachments, Device } from '../api/device-api';
import { getRoomDetail, type RoomNodeSummary } from '../api/room-api';
import DeviceForm from '../components/device/device-form';

export default function RoomDeviceEditPage() {
  const { roomId, deviceId } = useParams<{ roomId: string; deviceId: string }>();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [room, setRoom] = useState<RoomNodeSummary | null>(null);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId || !deviceId) return;
    getRoomDetail(roomId).then(setRoom).catch(() => {});
    Promise.all([
      getDevice(deviceId).then(setDevice),
      getAttachments(deviceId).then(a => setAttachmentCount(a.length)).catch(() => {}),
    ])
      .catch(() => setError('Không tìm thấy thiết bị'))
      .finally(() => setLoading(false));
  }, [roomId, deviceId]);

  const handleSubmit = async (formData: FormData) => {
    await updateDevice(deviceId, formData);
    navigate(`/rooms/${roomId}/devices/${deviceId}`);
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  if (error) return <div className="max-w-3xl mx-auto"><div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100">{error}</div></div>;

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="mb-6 flex">
        <Link to={`/rooms/${roomId}/devices/${deviceId}`} className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">
          <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Quay lại Chi tiết
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Sửa thiết bị</h1>
        {device && room && <p className="text-slate-500 text-sm">{room.name} → {device.name}</p>}
      </div>
      <DeviceForm initialData={device} existingAttachmentCount={attachmentCount} onSubmit={handleSubmit} submitLabel="Cập nhật Thiết bị" />
    </div>
  );
}

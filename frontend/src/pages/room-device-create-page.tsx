import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { getRoomDetail, type RoomNodeSummary } from '../api/room-api';
import { createRoomDevice } from '../api/room-device-api';
import DeviceForm from '../components/device/device-form';

export default function RoomDeviceCreatePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomNodeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;
    getRoomDetail(roomId).then(setRoom).catch(() => {}).finally(() => setLoading(false));
  }, [roomId]);

  const handleSubmit = async (formData: FormData) => {
    const device = await createRoomDevice(roomId!, formData);
    navigate(`/rooms/${roomId}/devices/${device.id}`);
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="mb-6 flex">
        <Link to={`/rooms?select=${roomId}`} className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">
          <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Quay lại {room?.name || 'phòng'}
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Thêm thiết bị vào phòng</h1>
        {room && <p className="text-slate-500 mt-2">{room.breadcrumb}</p>}
      </div>

      <DeviceForm onSubmit={handleSubmit} submitLabel="Tạo Thiết bị" />
    </div>
  );
}

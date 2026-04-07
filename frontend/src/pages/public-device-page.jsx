import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicDevice } from '../api/device-api';

export default function PublicDevicePage() {
  const { id } = useParams();
  const [device, setDevice] = useState(null);
  const [error, setError] = useState(null);

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">{device.name}</h1>
        <p className="text-gray-600">Mã thiết bị: <span className="font-mono">{device.id}</span></p>
        {device.location_name && (
          <p className="text-gray-600 mt-1">Vị trí: <span className="font-semibold">{device.location_name}</span></p>
        )}
      </div>
    </div>
  );
}

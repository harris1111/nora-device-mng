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
      .catch(() => setError('Device not found'));
  }, [id]);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-red-500 text-xl">{error}</p>
    </div>
  );

  if (!device) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">{device.name}</h1>
        <p className="text-gray-600">Device ID: <span className="font-mono">{device.id}</span></p>
      </div>
    </div>
  );
}

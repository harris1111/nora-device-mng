import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDevices } from '../api/device-api';
import DeviceCard from '../components/device-card';

export default function DeviceListPage() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDevices()
      .then(setDevices)
      .catch(() => setError('Failed to load devices'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Devices</h1>
          <Link
            to="/devices/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            + Add Device
          </Link>
        </div>

        {loading && <p className="text-gray-500">Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && devices.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg">No devices yet</p>
            <p className="mt-2">Click "Add Device" to create your first device.</p>
          </div>
        )}

        {!loading && devices.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {devices.map((device) => (
              <DeviceCard key={device.id} device={device} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

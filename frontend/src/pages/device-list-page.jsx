import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDevices } from '../api/device-api';
import DeviceCard from '../components/device-card';
import DeviceListRow from '../components/device-list-row';
import ViewToggle from '../components/view-toggle';

export default function DeviceListPage() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState(() => localStorage.getItem('deviceView') || 'grid');

  useEffect(() => {
    getDevices()
      .then(setDevices)
      .catch(() => setError('Failed to load devices'))
      .finally(() => setLoading(false));
  }, []);

  const handleViewChange = (newView) => {
    setView(newView);
    localStorage.setItem('deviceView', newView);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Devices</h1>
          <div className="flex items-center gap-3">
            <ViewToggle view={view} onChange={handleViewChange} />
            <Link
              to="/devices/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              + Add Device
            </Link>
          </div>
        </div>

        {loading && <p className="text-gray-500">Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && devices.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg">No devices yet</p>
            <p className="mt-2">Click "Add Device" to create your first device.</p>
          </div>
        )}

        {!loading && devices.length > 0 && view === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {devices.map((device) => (
              <DeviceCard key={device.id} device={device} />
            ))}
          </div>
        )}

        {!loading && devices.length > 0 && view === 'list' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Image</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">UUID</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Store ID</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Name</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <DeviceListRow key={device.id} device={device} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getDevice, deleteDevice, deviceImageUrl } from '../api/device-api';
import QrcodeDisplay from '../components/qrcode-display';
import PrintQrcodeButton from '../components/print-qrcode-button';

export default function DeviceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDevice(id)
      .then(setDevice)
      .catch(() => setError('Device not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${device.name}"?`)) return;
    try {
      await deleteDevice(id);
      navigate('/devices');
    } catch {
      setError('Failed to delete device');
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (error) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-red-500">{error}</p></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to="/devices" className="text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Devices</Link>

        <div className="bg-white rounded-lg shadow p-6 mt-4">
          {device.image_mime && (
            <div className="mb-6">
              <img
                src={deviceImageUrl(device.id)}
                alt={device.name}
                className="max-h-80 rounded-lg object-contain mx-auto"
              />
            </div>
          )}

          <h1 className="text-2xl font-bold text-gray-800">{device.name}</h1>
          <p className="text-sm text-gray-500 mt-2">Store ID: <span className="font-mono font-semibold text-gray-700">{device.store_id}</span></p>
          <p className="text-sm text-gray-500 mt-1">
            Created: {new Date(device.created_at + 'Z').toLocaleString()}
          </p>

          {/* QR code section */}
          <div className="mt-6 pt-6 border-t">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">QR Code</h2>
            <QrcodeDisplay deviceId={device.id} className="w-48 h-48" />
            <div className="mt-3">
              <PrintQrcodeButton />
            </div>
          </div>

          {/* Print area — hidden on screen, visible on print */}
          <div id="print-area">
            <QrcodeDisplay deviceId={device.id} className="w-48 h-48 mx-auto" />
            <p className="mt-2 text-lg font-bold">{device.name}</p>
            <p className="text-sm text-gray-600">ID: {device.store_id}</p>
          </div>

          <div className="mt-6 flex gap-3">
            <Link
              to={`/devices/${device.id}/edit`}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Edit
            </Link>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

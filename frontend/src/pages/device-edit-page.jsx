import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDevice, updateDevice } from '../api/device-api';
import DeviceForm from '../components/device-form';

export default function DeviceEditPage() {
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

  const handleSubmit = async (formData) => {
    await updateDevice(id, formData);
    navigate(`/devices/${id}`);
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (error) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-red-500">{error}</p></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Edit Device</h1>
        <DeviceForm initialData={device} onSubmit={handleSubmit} submitLabel="Update Device" />
      </div>
    </div>
  );
}

import { useNavigate, Link } from 'react-router-dom';
import { createDevice } from '../api/device-api';
import DeviceForm from '../components/device-form';

export default function DeviceCreatePage() {
  const navigate = useNavigate();

  const handleSubmit = async (formData) => {
    const device = await createDevice(formData);
    navigate(`/devices/${device.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Link to="/devices" className="text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Devices</Link>
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Add New Device</h1>
        <DeviceForm onSubmit={handleSubmit} submitLabel="Create Device" />
      </div>
    </div>
  );
}

import { useNavigate, Link } from 'react-router-dom';
import { createDevice } from '../api/device-api';
import DeviceForm from '../components/device-form';

export default function DeviceCreatePage() {
  const navigate = useNavigate();

  const handleSubmit = async (formData: FormData) => {
    const device = await createDevice(formData);
    navigate(`/devices/${device.id}`);
  };

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="mb-6 flex justify-between items-center hidden md:flex">
         <Link to="/devices" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">
            <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Quay lại Thiết bị
         </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Thêm Thiết bị Mới</h1>
        <p className="text-slate-500 mt-2">Nhập thông tin chi tiết để thêm thiết bị quản lý vào hệ thống.</p>
      </div>
      
      <DeviceForm onSubmit={handleSubmit} submitLabel="Tạo Thiết bị" />
    </div>
  );
}

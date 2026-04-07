import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
      .catch(() => setError('Không tìm thấy thiết bị'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (formData) => {
    await updateDevice(id, formData);
    navigate(`/devices/${id}`);
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/3 mb-8"></div>
        <div className="h-96 bg-white rounded-xl border border-slate-100"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-2">
           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
           {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="mb-6 flex justify-between items-center hidden md:flex">
         <Link to={`/devices/${id}`} className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">
            <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Quay lại Chi tiết
         </Link>
      </div>

      <div className="mb-8 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0">
           <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        </div>
        <div>
           <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Sửa Thiết bị</h1>
           <p className="text-slate-500 text-sm">Cập nhật thông tin cho {device?.name}</p>
        </div>
      </div>

      <DeviceForm initialData={device} onSubmit={handleSubmit} submitLabel="Cập nhật Thiết bị" />
    </div>
  );
}

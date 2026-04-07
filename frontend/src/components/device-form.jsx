import { useState, useEffect } from 'react';
import { deviceImageUrl, getLocations } from '../api/device-api';

export default function DeviceForm({ initialData, onSubmit, submitLabel = 'Lưu' }) {
  const [name, setName] = useState(initialData?.name || '');
  const [storeId, setStoreId] = useState(initialData?.store_id || '');
  const [locationId, setLocationId] = useState(initialData?.location_id || '');
  const [locations, setLocations] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(
    initialData?.id && initialData?.image_mime ? deviceImageUrl(initialData.id) : null
  );

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  useEffect(() => {
    getLocations()
      .then(setLocations)
      .catch(() => {});
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!storeId.trim()) { setError('Mã thiết bị là bắt buộc'); return; }
    if (!name.trim()) { setError('Tên là bắt buộc'); return; }
    if (!locationId) { setError('Vị trí là bắt buộc'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('store_id', storeId.trim());
      formData.append('name', name.trim());
      formData.append('location_id', locationId);
      if (imageFile) formData.append('image', imageFile);
      await onSubmit(formData);
    } catch (err) {
      setError(err.response?.data?.error || 'Đã xảy ra lỗi');
      setSubmitting(false);
    }
  };

  const isComplete = name.trim() && storeId.trim() && locationId;

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {error && (
        <div className="p-4 mb-6 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-2">
           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {error}
        </div>
      )}

      <div className="card-glass border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        <div className="p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5 focus-within:text-indigo-600 focus-within:font-medium transition-all">
              <label htmlFor="store_id" className="block text-sm text-slate-700 font-semibold mb-1">
                Mã thiết bị <span className="text-red-500">*</span>
              </label>
              <input
                id="store_id"
                type="text"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono"
                placeholder="Ví dụ: TB-001"
              />
            </div>

            <div className="space-y-1.5 focus-within:text-indigo-600 focus-within:font-medium transition-all">
              <label htmlFor="name" className="block text-sm text-slate-700 font-semibold mb-1">
                Tên thiết bị <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-800"
                placeholder="Nhập tên thiết bị"
              />
            </div>

            <div className="space-y-1.5 focus-within:text-indigo-600 focus-within:font-medium transition-all md:col-span-2">
              <label htmlFor="location_id" className="block text-sm text-slate-700 font-semibold mb-1">
                Vị trí (Phòng ban/Khu vực) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  id="location_id"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="" disabled>-- Chọn vị trí --</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2 pt-2 border-t border-slate-100 mt-2">
              <label htmlFor="image" className="block text-sm text-slate-700 font-semibold mb-2">
                Hình ảnh (Tùy chọn)
              </label>
              
              <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                <div className={`relative w-40 h-40 shrink-0 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center overflow-hidden transition-colors ${imagePreview ? 'border-transparent bg-slate-100' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}>
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-slate-400 text-center p-4">
                       <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                       <span className="text-xs">Chưa có ảnh</span>
                    </div>
                  )}
                  {/* Invisible file input over the preview box for easy clicking */}
                  <input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                
                <div className="flex-1">
                  <p className="text-sm text-slate-500 mb-3">
                    Nhấn vào hộp hình để tải ảnh lên. Các định dạng được hỗ trợ: JPG, PNG, WEBP.
                  </p>
                  <label htmlFor="image" className="inline-flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 text-sm font-semibold rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer border border-indigo-100">
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    {imagePreview ? 'Thay đổi ảnh' : 'Chọn tệp'}
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-50 p-6 md:p-8 flex items-center justify-between border-t border-slate-100">
          <p className="text-sm text-slate-500 hidden sm:block">Các trường đánh dấu <span className="text-red-500">*</span> là bắt buộc</p>
          <button
            type="submit"
            disabled={submitting || !isComplete}
            className="w-full sm:w-auto px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-sm shadow-indigo-200 active:scale-95 text-lg sm:text-base flex justify-center items-center gap-2"
          >
            {submitting ? (
              <><svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Đang lưu...</>
            ) : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

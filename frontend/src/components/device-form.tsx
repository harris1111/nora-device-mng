import { useState, useEffect } from 'react';
import { getLocations, Device, Location, attachmentFileUrl } from '../api/device-api';
import FormTextInput from './form-text-input';
import { DEVICE_TYPES, STATUS_BY_TYPE } from './device-constants';

interface Props {
  initialData?: Device | null;
  existingAttachmentCount?: number;
  onSubmit: (formData: FormData) => Promise<void>;
  submitLabel?: string;
}

export default function DeviceForm({ initialData, existingAttachmentCount, onSubmit, submitLabel = 'Lưu' }: Props) {
  const [name, setName] = useState(initialData?.name || '');
  const [storeId, setStoreId] = useState(initialData?.store_id || '');
  const [locationId, setLocationId] = useState(initialData?.location_id || '');
  const [ownedBy, setOwnedBy] = useState(initialData?.owned_by || '');
  const [serialNumber, setSerialNumber] = useState(initialData?.serial_number || '');
  const [model, setModel] = useState(initialData?.model || '');
  const [manufacturer, setManufacturer] = useState(initialData?.manufacturer || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [type, setType] = useState(initialData?.type || 'tai_san');
  const [status, setStatus] = useState(initialData?.status || 'active');
  const [transferTo, setTransferTo] = useState(initialData?.transfer_to || '');
  const [transferDate, setTransferDate] = useState(initialData?.transfer_date?.split('T')[0] || '');
  const [disposalDate, setDisposalDate] = useState(initialData?.disposal_date?.split('T')[0] || '');
  const [lossDate, setLossDate] = useState(initialData?.loss_date?.split('T')[0] || '');
  const [locations, setLocations] = useState<Location[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File upload state
  const [primaryImage, setPrimaryImage] = useState<File | null>(null);
  const [primaryPreview, setPrimaryPreview] = useState<string | null>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);

  useEffect(() => {
    getLocations().then(setLocations).catch(() => setError('Không thể tải danh sách vị trí.'));
  }, []);

  // Reset status when type changes
  useEffect(() => {
    const valid = STATUS_BY_TYPE[type]?.map(s => s.value) || [];
    if (!valid.includes(status)) setStatus(valid[0] || 'active');
  }, [type]);

  const availableStatuses = STATUS_BY_TYPE[type] || [];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!storeId.trim()) { setError('Mã thiết bị là bắt buộc'); return; }
    if (!name.trim()) { setError('Tên là bắt buộc'); return; }
    if (!locationId) { setError('Vị trí là bắt buộc'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('store_id', storeId.trim());
      fd.append('name', name.trim());
      fd.append('location_id', locationId);
      fd.append('owned_by', ownedBy);
      fd.append('serial_number', serialNumber.trim());
      fd.append('model', model.trim());
      fd.append('manufacturer', manufacturer.trim());
      fd.append('description', description.trim());
      fd.append('type', type);
      fd.append('status', status);
      if (transferTo.trim()) fd.append('transfer_to', transferTo.trim());
      if (transferDate) fd.append('transfer_date', transferDate);
      if (type === 'cong_cu_dung_cu' && disposalDate) fd.append('disposal_date', disposalDate);
      if (type === 'cong_cu_dung_cu' && lossDate) fd.append('loss_date', lossDate);
      if (primaryImage) fd.append('primary_image', primaryImage);
      attachmentFiles.forEach(f => fd.append('attachments', f));
      await onSubmit(fd);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Đã xảy ra lỗi');
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
            <FormTextInput id="store_id" label="Mã thiết bị" value={storeId} onChange={setStoreId} required mono placeholder="Ví dụ: TB-001" />
            <FormTextInput id="name" label="Tên thiết bị" value={name} onChange={setName} required placeholder="Nhập tên thiết bị" />

            {/* Type & Status */}
            <div className="space-y-1.5 focus-within:text-indigo-600 transition-all">
              <label htmlFor="type" className="block text-sm text-slate-700 font-semibold mb-1">Loại thiết bị <span className="text-red-500">*</span></label>
              <div className="relative">
                <select id="type" value={type} onChange={(e) => setType(e.target.value)} required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none cursor-pointer">
                  {DEVICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 focus-within:text-indigo-600 transition-all">
              <label htmlFor="status" className="block text-sm text-slate-700 font-semibold mb-1">Trạng thái <span className="text-red-500">*</span></label>
              <div className="relative">
                <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none cursor-pointer">
                  {availableStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            {/* Location dropdown */}
            <div className="space-y-1.5 focus-within:text-indigo-600 focus-within:font-medium transition-all md:col-span-2">
              <label htmlFor="location_id" className="block text-sm text-slate-700 font-semibold mb-1">
                Vị trí (Phòng ban/Khu vực) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select id="location_id" value={locationId} onChange={(e) => setLocationId(e.target.value)} required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none cursor-pointer">
                  <option value="" disabled>-- Chọn vị trí --</option>
                  {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            <FormTextInput id="serial_number" label="Số serial" value={serialNumber} onChange={setSerialNumber} mono placeholder="Ví dụ: SN-2024-001" />
            <FormTextInput id="manufacturer" label="Nhà sản xuất" value={manufacturer} onChange={setManufacturer} placeholder="Ví dụ: Dell, HP, Mitsubishi" />
            <FormTextInput id="model" label="Model" value={model} onChange={setModel} colSpan2 placeholder="Ví dụ: Latitude 5540, LaserJet Pro" />

            {/* Transfer fields */}
            <div className="md:col-span-2 pt-4 border-t border-slate-100 mt-2">
              <p className="text-sm font-semibold text-slate-700 mb-3">Thông tin chuyển giao (tùy chọn)</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 focus-within:text-indigo-600 transition-all">
                  <label htmlFor="owned_by" className="block text-sm text-slate-700 font-semibold mb-1">Chuyển giao cho</label>
                  <div className="relative">
                    <select id="owned_by" value={ownedBy} onChange={(e) => setOwnedBy(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none cursor-pointer">
                      <option value="">-- Chọn bộ phận --</option>
                      {locations.map((loc) => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>
                <FormTextInput id="transfer_to" label="Người nhận" value={transferTo} onChange={setTransferTo} placeholder="Tên người nhận" />
                <div className="space-y-1.5">
                  <label htmlFor="transfer_date" className="block text-sm text-slate-700 font-semibold mb-1">Ngày chuyển giao</label>
                  <input id="transfer_date" type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" />
                </div>
              </div>
            </div>

            {/* CCDC-specific date fields */}
            {type === 'cong_cu_dung_cu' && (
              <div className="md:col-span-2 pt-4 border-t border-slate-100 mt-2">
                <p className="text-sm font-semibold text-slate-700 mb-3">Ngày xử lý / mất (Công cụ dụng cụ)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="disposal_date" className="block text-sm text-slate-700 font-semibold mb-1">Ngày xử lý</label>
                    <input id="disposal_date" type="date" value={disposalDate} onChange={e => setDisposalDate(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="loss_date" className="block text-sm text-slate-700 font-semibold mb-1">Ngày mất</label>
                    <input id="loss_date" type="date" value={lossDate} onChange={e => setLossDate(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" />
                  </div>
                </div>
              </div>
            )}

            <FormTextInput id="description" label="Ghi chú" value={description} onChange={setDescription} colSpan2 multiline placeholder="Mô tả thêm về thiết bị..." />

            {/* Primary Image section */}
            <div className="md:col-span-2 pt-4 border-t border-slate-100 mt-2">
              <p className="text-sm font-semibold text-slate-700 mb-3">Hình ảnh chính (tùy chọn)</p>
              {(primaryPreview || (!primaryImage && initialData?.primary_attachment_id)) ? (
                <div className="flex items-start gap-4">
                  <img
                    src={primaryPreview || attachmentFileUrl(initialData!.primary_attachment_id!)}
                    alt="Preview"
                    className="w-32 h-32 object-cover rounded-xl border border-slate-200"
                  />
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors border border-slate-200">
                      Đổi ảnh
                      <input type="file" accept="image/*" className="hidden" onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) { setPrimaryImage(file); setPrimaryPreview(URL.createObjectURL(file)); }
                      }} />
                    </label>
                    <button type="button" onClick={() => { setPrimaryImage(null); setPrimaryPreview(null); }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg text-red-600 hover:bg-red-50 transition-colors border border-red-200">
                      Xóa
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all">
                  <svg className="w-8 h-8 text-slate-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="text-xs text-slate-400">JPG, PNG, WebP, GIF (≤ 10MB)</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) { setPrimaryImage(file); setPrimaryPreview(URL.createObjectURL(file)); }
                  }} />
                </label>
              )}
            </div>

            {/* Attachments section */}
            <div className="md:col-span-2 pt-4 border-t border-slate-100 mt-2">
              <p className="text-sm font-semibold text-slate-700 mb-3">Tệp đính kèm (tùy chọn)</p>
              {initialData && (existingAttachmentCount ?? 0) > 0 && (
                <p className="text-xs text-slate-400 mb-2">Tệp đính kèm hiện có: {existingAttachmentCount} tệp. Quản lý tệp đính kèm ở trang chi tiết.</p>
              )}
              {attachmentFiles.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {attachmentFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-3 bg-slate-50 rounded-lg border border-slate-100 text-sm">
                      <span className="truncate text-slate-600">{f.name} <span className="text-slate-400">({(f.size / 1024).toFixed(0)} KB)</span></span>
                      <button type="button" onClick={() => setAttachmentFiles(prev => prev.filter((_, j) => j !== i))}
                        className="text-slate-400 hover:text-red-500 ml-2 shrink-0">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl cursor-pointer border bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 active:scale-95 transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Chọn tệp
                <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={e => {
                  const files = Array.from(e.target.files || []);
                  setAttachmentFiles(prev => [...prev, ...files].slice(0, 9));
                  e.target.value = '';
                }} />
              </label>
              <p className="text-xs text-slate-400 mt-1.5">JPG, PNG, WebP, GIF, PDF (≤ 10MB, tối đa 9 tệp)</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-6 md:p-8 flex items-center justify-between border-t border-slate-100">
          <p className="text-sm text-slate-500 hidden sm:block">Các trường đánh dấu <span className="text-red-500">*</span> là bắt buộc</p>
          <button type="submit" disabled={submitting || !isComplete}
            className="w-full sm:w-auto px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-sm shadow-indigo-200 active:scale-95 text-lg sm:text-base flex justify-center items-center gap-2">
            {submitting ? (
              <><svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Đang lưu...</>
            ) : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

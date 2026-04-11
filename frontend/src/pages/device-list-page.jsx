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
  const [search, setSearch] = useState('');

  useEffect(() => {
    getDevices()
      .then(setDevices)
      .catch(() => setError('Không thể tải danh sách thiết bị'))
      .finally(() => setLoading(false));
  }, []);

  const handleViewChange = (newView) => {
    setView(newView);
    localStorage.setItem('deviceView', newView);
  };

  const filteredDevices = devices.filter((d) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return d.name?.toLowerCase().includes(q) || d.store_id?.toLowerCase().includes(q) || d.location_name?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Desktop Hidden Header (moved to layout), Custom Floating Action Bar for Mobile/Desktop */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-slate-100 mb-6">
        <div className="flex-1 w-full relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border-0 text-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-shadow sm:text-sm"
            placeholder="Tìm kiếm thiết bị..."
          />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0 self-end md:self-auto">
          <ViewToggle view={view} onChange={handleViewChange} />
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
             <div key={i} className="h-64 bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-4 animate-pulse">
               <div className="w-full h-32 bg-slate-200 rounded-xl"></div>
               <div className="h-4 bg-slate-200 rounded w-3/4"></div>
               <div className="h-4 bg-slate-200 rounded w-1/2"></div>
             </div>
          ))}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm font-medium flex items-center gap-2">
           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {error}
        </div>
      )}

      {!loading && !error && filteredDevices.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 border-dashed shadow-sm flex flex-col items-center">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500 mb-4">
             <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
             </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-800">Chưa có thiết bị nào</h3>
          <p className="mt-2 text-slate-500 text-sm max-w-sm mx-auto">Nhấn nút thêm ở góc phải (hoặc bên dưới) để bắt đầu tạo thiết bị quản lý đầu tiên.</p>
        </div>
      )}

      {/* Grid View */}
      {!loading && filteredDevices.length > 0 && view === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredDevices.map((device, index) => (
            <div key={device.id} className="animate-slide-up" style={{ animationDelay: `${Math.min(index * 50, 500)}ms`, animationFillMode: 'both' }}>
               <DeviceCard device={device} />
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {!loading && filteredDevices.length > 0 && view === 'list' && (
        <div className="card-glass bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">Hình ảnh</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">Mã thiết bị</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">Tên thiết bị</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">Vị trí</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">Đang sử dụng bởi</th>
                <th className="px-6 py-4 border-b border-slate-100"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredDevices.map((device) => (
                 <DeviceListRow key={device.id} device={device} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

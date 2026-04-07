import { Link } from 'react-router-dom';
import { deviceImageUrl } from '../api/device-api';

export default function DeviceCard({ device }) {
  return (
    <Link
      to={`/devices/${device.id}`}
      className="block card-glass card-hover-fx group"
    >
      <div className="aspect-video bg-slate-100 flex items-center justify-center relative overflow-hidden">
        {device.image_mime ? (
          <img
            src={deviceImageUrl(device.id)}
            alt={device.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-bold text-slate-800 text-lg truncate mb-1">{device.name}</h3>
        <p className="text-sm text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded inline-block mb-3">{device.store_id}</p>
        
        <div className="flex items-center text-sm tracking-tight text-slate-600 mb-2">
          <svg className="w-4 h-4 mr-1.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="truncate">{device.location_name || 'Chưa xếp vị trí'}</span>
        </div>
        
        <p className="text-xs text-slate-400 border-t border-slate-100 pt-3 mt-3">
          Tạo ngày: {new Date(device.created_at + 'Z').toLocaleDateString('vi-VN')}
        </p>
      </div>
    </Link>
  );
}

import { Link } from 'react-router-dom';
import { deviceImageUrl } from '../api/device-api';

export default function DeviceListRow({ device }) {
  return (
    <Link
      to={`/devices/${device.id}`}
      className="flex items-center gap-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow p-3"
    >
      <div className="w-16 h-16 flex-shrink-0 bg-gray-200 rounded overflow-hidden flex items-center justify-center">
        {device.image_mime ? (
          <img
            src={deviceImageUrl(device.id)}
            alt={device.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-800 truncate">{device.name}</h3>
        <p className="text-sm text-gray-500">{new Date(device.created_at + 'Z').toLocaleDateString()}</p>
      </div>
      <p className="text-xs text-gray-400 font-mono hidden sm:block">{device.store_id}</p>
    </Link>
  );
}

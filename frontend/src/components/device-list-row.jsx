import { Link } from 'react-router-dom';
import { deviceImageUrl } from '../api/device-api';

export default function DeviceListRow({ device }) {
  return (
    <tr className="hover:bg-gray-50 border-b">
      <td className="px-4 py-3">
        <div className="w-12 h-12 bg-gray-200 rounded overflow-hidden flex items-center justify-center">
          {device.image_mime ? (
            <img
              src={deviceImageUrl(device.id)}
              alt={device.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xs text-gray-400">No img</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-gray-500">{device.id}</td>
      <td className="px-4 py-3 font-mono text-sm font-semibold text-gray-700">{device.store_id}</td>
      <td className="px-4 py-3">
        <Link to={`/devices/${device.id}`} className="text-gray-800 hover:text-blue-600 font-medium">
          {device.name}
        </Link>
      </td>
    </tr>
  );
}

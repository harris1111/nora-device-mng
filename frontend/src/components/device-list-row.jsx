import { Link } from 'react-router-dom';
import { deviceImageUrl } from '../api/device-api';

export default function DeviceListRow({ device }) {
  return (
    <tr className="hover:bg-indigo-50/30 transition-colors group">
      <td className="w-16 px-6 py-4">
        <div className="w-12 h-12 bg-slate-100 rounded-xl shadow-sm border border-slate-200 overflow-hidden flex items-center justify-center">
          {device.image_mime ? (
            <img
              src={deviceImageUrl(device.id)}
              alt={device.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <span className="font-mono text-sm font-semibold text-slate-600 bg-slate-100/80 rounded-lg px-2.5 py-1 inline-block border border-slate-200">
          {device.store_id}
        </span>
      </td>
      <td className="px-6 py-4">
        <Link to={`/devices/${device.id}`} className="text-slate-800 hover:text-indigo-600 font-bold block truncate max-w-xs transition-colors">
          {device.name}
        </Link>
      </td>
      <td className="px-6 py-4">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm">
          {device.location_name ? (
             <><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-1.5"></div>{device.location_name}</>
          ) : (
             <><div className="w-1.5 h-1.5 bg-slate-400 rounded-full mr-1.5"></div>Chưa có</>
          )}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <Link 
          to={`/devices/${device.id}`} 
          className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all group-hover:shadow-sm border border-transparent group-hover:border-slate-200"
        >
           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
           </svg>
        </Link>
      </td>
    </tr>
  );
}

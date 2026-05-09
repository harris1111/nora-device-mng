import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { attachmentFileUrl, Device } from '../../api/device-api';
import DeviceStatusBadge from './device-status-badge';
import { getTypeName } from './device-constants';

interface Props {
  device: Device;
  selectionControl?: ReactNode;
}

export default function DeviceCard({ device, selectionControl }: Props) {
  const thumbUrl = device.primary_attachment_id ? attachmentFileUrl(device.primary_attachment_id) : null;

  return (
    <article className="group card-glass card-hover-fx overflow-hidden">
      <div className="relative aspect-[4/3] bg-slate-100">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={device.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg className="h-12 w-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <DeviceStatusBadge status={device.status} />
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm">
              {getTypeName(device.type)}
            </span>
          </div>
          {selectionControl && <div className="rounded-xl bg-white/90 p-1 shadow-sm">{selectionControl}</div>}
        </div>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        <div>
          <div className="mb-2 inline-flex rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-semibold text-slate-600">
            {device.store_id}
          </div>
          <Link to={`/devices/${device.id}`} className="block text-base font-bold text-slate-800 transition-colors hover:text-indigo-600 sm:text-lg">
            <span className="line-clamp-2">{device.name}</span>
          </Link>
        </div>

        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-start gap-2">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="line-clamp-2">{device.location_name || 'Chưa gán đơn vị trực thuộc'}</span>
          </div>

          {device.area_name && (
            <div className="flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span className="line-clamp-2">{device.area_name}</span>
            </div>
          )}
        </div>

        {device.owned_by && (
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"></div>
            <span className="truncate">{[device.location_name, device.owned_by].filter(Boolean).join(' → ')}</span>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
          <span>Tạo ngày: {new Date(device.created_at).toLocaleDateString('vi-VN')}</span>
          <Link to={`/devices/${device.id}`} className="font-semibold text-indigo-600 transition-colors hover:text-indigo-700">
            Xem chi tiết
          </Link>
        </div>
      </div>
    </article>
  );
}

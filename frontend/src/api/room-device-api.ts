import api from './api-client';
import { type Device } from './device-api';

export const getRoomDevices = (roomId: string): Promise<Device[]> =>
  api.get(`/rooms/${roomId}/devices`).then(r => r.data);

export const createRoomDevice = (roomId: string, formData: FormData): Promise<Device> =>
  api.post(`/rooms/${roomId}/devices`, formData).then(r => r.data);

export const duplicateRoom = (id: string, data: {
  target_parent_id?: string;
  name?: string;
  prefix?: string;
  start?: number;
  end?: number;
  mode?: 'single' | 'range' | 'list';
  list?: string;
}): Promise<{ rooms_created: number; devices_cloned: number }> =>
  api.post(`/rooms/${id}/duplicate`, data).then(r => r.data);

export const bulkDeleteRoomDevices = (roomId: string, ids: string[]): Promise<{ deleted: number }> =>
  api.post(`/rooms/${roomId}/devices/bulk-delete`, { ids }).then(r => r.data);

export const duplicateRoomToNode = (id: string, data: {
  target_parent_id: string;
  prefix?: string;
  suffix?: string;
  replace_from?: string;
  replace_to?: string;
}): Promise<{ rooms_created: number; devices_cloned: number }> =>
  api.post(`/rooms/${id}/duplicate-to-node`, data).then(r => r.data);


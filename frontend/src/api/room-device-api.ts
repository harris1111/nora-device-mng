import api from './api-client';
import { type Device } from './device-api';

export const getRoomDevices = (roomId: string): Promise<Device[]> =>
  api.get(`/rooms/${roomId}/devices`).then(r => r.data);

export const createRoomDevice = (roomId: string, formData: FormData): Promise<Device> =>
  api.post(`/rooms/${roomId}/devices`, formData).then(r => r.data);

export const duplicateRoom = (id: string, data: { prefix?: string; start?: number; end?: number; mode?: 'range' | 'list'; list?: string }): Promise<{ rooms_created: number; devices_cloned: number }> =>
  api.post(`/rooms/${id}/duplicate`, data).then(r => r.data);

import api from './api-client';

export interface RoomNodeResponse {
  id: string;
  name: string;
  code: string | null;
  description: string;
  parentId: string | null;
  path: string;
  status: string;
  deviceCount: number;
  children: RoomNodeResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface FlatRoomNode {
  id: string;
  name: string;
  code: string | null;
  description: string;
  parentId: string | null;
  path: string;
  status: string;
  deviceCount: number;
  createdAt: string;
  updatedAt: string;
  children: undefined;
}

export interface DuplicateRequest {
  range_start: number;
  range_end: number;
  name_prefix?: string;
  name_suffix?: string;
  clone_devices: boolean;
}

export interface DuplicateResponse {
  rooms: Array<{ id: string }>;
  devicesCloned: number;
}

export const getRoomTree = (): Promise<RoomNodeResponse[]> =>
  api.get('/rooms/tree').then(r => r.data);

export const listRooms = (parentId?: string): Promise<FlatRoomNode[]> =>
  api.get('/rooms', { params: parentId ? { parentId } : undefined }).then(r => r.data);

export const getRoom = (id: string): Promise<RoomNodeResponse> =>
  api.get(`/rooms/${id}`).then(r => r.data);

export const createRoom = (data: { name: string; code?: string; description?: string; parent_id?: string }): Promise<RoomNodeResponse> =>
  api.post('/rooms', data).then(r => r.data);

export const updateRoom = (id: string, data: { name?: string; code?: string | null; description?: string }): Promise<RoomNodeResponse> =>
  api.put(`/rooms/${id}`, data).then(r => r.data);

export const moveRoom = (id: string, parent_id: string | null): Promise<RoomNodeResponse> =>
  api.put(`/rooms/${id}/move`, { parent_id }).then(r => r.data);

export const deleteRoom = (id: string): Promise<void> =>
  api.delete(`/rooms/${id}`);

export const assignDeviceToRoom = (roomId: string, deviceId: string): Promise<{ success: boolean; message: string }> =>
  api.put(`/rooms/${roomId}/assign-device`, { device_id: deviceId }).then(r => r.data);

export const unassignDeviceFromRoom = (deviceId: string): Promise<{ success: boolean; message: string }> =>
  api.put('/rooms/unassign-device', { device_id: deviceId }).then(r => r.data);

export const duplicateRoom = (id: string, data: DuplicateRequest): Promise<DuplicateResponse> =>
  api.post(`/rooms/${id}/duplicate`, data).then(r => r.data);

import api from './api-client';

export interface RoomNodeSummary {
  id: string;
  name: string;
  parent_id: string | null;
  breadcrumb: string;
  device_count: number;
  descendant_device_count: number;
  status: 'in_use' | 'needs_maintenance';
  has_children: boolean;
  is_leaf: boolean;
  created_at: string;
}

export interface RoomTreeNode extends RoomNodeSummary {
  children: RoomTreeNode[];
}

export const getRooms = (): Promise<RoomNodeSummary[]> =>
  api.get('/rooms').then(r => r.data);

export const getRoomTree = (): Promise<RoomTreeNode[]> =>
  api.get('/rooms/tree').then(r => r.data);

export const getRoomDetail = (id: string): Promise<RoomNodeSummary> =>
  api.get(`/rooms/${id}`).then(r => r.data);

export const createRoom = (data: { name: string; parent_id?: string | null }): Promise<RoomNodeSummary> =>
  api.post('/rooms', data).then(r => r.data);

export const updateRoom = (id: string, data: { name: string; parent_id?: string | null }): Promise<RoomNodeSummary> =>
  api.put(`/rooms/${id}`, data).then(r => r.data);

export const deleteRoom = (id: string): Promise<void> =>
  api.delete(`/rooms/${id}`);


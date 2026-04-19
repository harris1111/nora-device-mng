import api from './api-client';
import type { Location } from './device-api';

export interface UserItem {
  id: string;
  username: string;
  role: 'SADMIN' | 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'LOCKED';
  created_at: string;
  updated_at: string;
  assigned_locations?: { id: string; name: string }[];
}

export const getUsers = (): Promise<UserItem[]> => api.get('/users').then(r => r.data);
export const getUser = (id: string): Promise<UserItem> => api.get(`/users/${id}`).then(r => r.data);
export const createUser = (data: { username: string; password: string; role: string }): Promise<UserItem> => api.post('/users', data).then(r => r.data);
export const updateUser = (id: string, data: { username: string }): Promise<UserItem> => api.put(`/users/${id}`, data).then(r => r.data);
export const resetUserPassword = (id: string, newPassword: string): Promise<void> => api.put(`/users/${id}/reset-password`, { newPassword }).then(() => {});
export const updateUserStatus = (id: string, status: string): Promise<UserItem> => api.put(`/users/${id}/status`, { status }).then(r => r.data);
export const deleteUser = (id: string): Promise<void> => api.delete(`/users/${id}`).then(() => {});

// User-location assignments
export const getUserLocations = (id: string): Promise<Location[]> => api.get(`/users/${id}/locations`).then(r => r.data);
export const updateUserLocations = (id: string, locationIds: string[]): Promise<Location[]> => api.put(`/users/${id}/locations`, { locationIds }).then(r => r.data);

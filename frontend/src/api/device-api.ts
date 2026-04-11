import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Shared interfaces
export interface Device {
  id: string;
  store_id: string;
  name: string;
  type: string;
  status: string;
  location_id: string;
  location_name: string | null;
  owned_by: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  description: string | null;
  transfer_to: string | null;
  transfer_date: string | null;
  disposal_date: string | null;
  loss_date: string | null;
  primary_attachment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  name: string;
  created_at: string;
}

export interface Attachment {
  id: string;
  device_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  is_primary: boolean;
  created_at: string;
}

export interface MaintenanceRecord {
  id: string;
  device_id: string;
  date: string;
  description: string;
  performed_by: string | null;
  cost: number | null;
  created_at: string;
}

export interface PublicDevice extends Device {
  attachments: Attachment[];
  maintenance_records: MaintenanceRecord[];
}

// Device API
export const getDevices = (params?: Record<string, string>): Promise<Device[]> => api.get('/devices', { params }).then(r => r.data);
export const getDevice = (id: string | undefined): Promise<Device> => api.get(`/devices/${id}`).then(r => r.data);
export const createDevice = (formData: FormData): Promise<Device> => api.post('/devices', formData).then(r => r.data);
export const updateDevice = (id: string | undefined, formData: FormData): Promise<Device> => api.put(`/devices/${id}`, formData).then(r => r.data);
export const deleteDevice = (id: string | undefined) => api.delete(`/devices/${id}`);

export const deviceQrcodeUrl = (id: string): string => `/api/devices/${id}/qrcode`;
export const getPublicDevice = (id: string | undefined): Promise<PublicDevice> => api.get(`/public/device/${id}`).then(r => r.data);

// Attachment API
export const getAttachments = (deviceId: string): Promise<Attachment[]> => api.get(`/devices/${deviceId}/attachments`).then(r => r.data);
export const uploadAttachments = (deviceId: string, files: File[]) => {
  const fd = new FormData();
  files.forEach(f => fd.append('files', f));
  return api.post(`/devices/${deviceId}/attachments`, fd).then(r => r.data);
};
export const deleteAttachment = (id: string) => api.delete(`/attachments/${id}`);
export const setAttachmentPrimary = (id: string) => api.patch(`/attachments/${id}/primary`).then(r => r.data);
export const attachmentFileUrl = (id: string): string => `/api/attachments/${id}/file`;

// Maintenance API
export const getMaintenanceRecords = (deviceId: string): Promise<MaintenanceRecord[]> => api.get(`/devices/${deviceId}/maintenance`).then(r => r.data);
export const createMaintenanceRecord = (deviceId: string, data: Record<string, unknown>) => api.post(`/devices/${deviceId}/maintenance`, data).then(r => r.data);
export const updateMaintenanceRecord = (id: string, data: Record<string, unknown>) => api.put(`/maintenance/${id}`, data).then(r => r.data);
export const deleteMaintenanceRecord = (id: string) => api.delete(`/maintenance/${id}`);
export const getMaintenanceAttachments = (recordId: string) => api.get(`/maintenance/${recordId}/attachments`).then(r => r.data);
export const uploadMaintenanceAttachment = (recordId: string, files: File[]) => {
  const fd = new FormData();
  files.forEach(f => fd.append('files', f));
  return api.post(`/maintenance/${recordId}/attachments`, fd).then(r => r.data);
};
export const maintenanceAttachmentUrl = (id: string): string => `/api/maintenance/attachments/${id}/file`;

// Location API
export const getLocations = (): Promise<Location[]> => api.get('/locations').then(r => r.data);
export const createLocation = (data: { name: string }): Promise<Location> => api.post('/locations', data).then(r => r.data);
export const updateLocationApi = (id: string, data: { name: string }) => api.put(`/locations/${id}`, data).then(r => r.data);
export const deleteLocationApi = (id: string) => api.delete(`/locations/${id}`);

import api from './api-client';

// Shared interfaces
export interface Device {
  id: string;
  store_id: string;
  name: string;
  type: string;
  status: string;
  location_id: string;
  location_name: string | null;
  area_id: string | null;
  area_name: string | null;
  owned_by: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  description: string | null;
  transfer_to: string | null;
  transfer_date: string | null;
  transfer_record?: TransferRecordItem | null;
  disposal_date: string | null;
  loss_date: string | null;
  warranty_period: string | null;
  maintenance_status?: 'in_use' | 'needs_maintenance';
  primary_attachment_id: string | null;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  created_at: string;
}

export interface Area {
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

export interface MaintenanceAttachmentItem {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface TransferAttachmentItem {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface TransferRecordItem {
  id: string | null;
  owned_by: string | null;
  transfer_to: string | null;
  transfer_date: string | null;
  attachments: TransferAttachmentItem[];
}

export interface MaintenanceRecord {
  id: string;
  device_id: string;
  date: string;
  description: string;
  technician: string | null;
  status: string;
  created_at: string;
  attachments: MaintenanceAttachmentItem[];
}

export interface PublicDevice extends Device {
  attachments: Attachment[];
  maintenance_records: MaintenanceRecord[];
}

// Device list pagination
export interface DeviceListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  status?: string;
  location_id?: string;
  area_id?: string;
  transfer_unit?: string;
  maintenance_status?: string;
  date_from?: string;
  date_to?: string;
}

export interface PaginatedDevices {
  items: Device[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// Device API
export const getDevices = (params?: DeviceListParams): Promise<PaginatedDevices> =>
  api.get('/devices', { params }).then(r => r.data);
export const getDevice = (id: string | undefined): Promise<Device> => api.get(`/devices/${id}`).then(r => r.data);
export const createDevice = (formData: FormData): Promise<Device> => api.post('/devices', formData).then(r => r.data);
export const updateDevice = (id: string | undefined, formData: FormData): Promise<Device> => api.put(`/devices/${id}`, formData).then(r => r.data);
export const deleteDevice = (id: string | undefined) => api.delete(`/devices/${id}`);

// Bulk operations
export const bulkDeleteDevices = (ids: string[]): Promise<{ deleted: number }> =>
  api.post('/devices/bulk-delete', { ids }).then(r => r.data);

export interface BulkEditPayload {
  ids: string[];
  status?: string;
  owned_by?: string;
  transfer_to?: string | null;
  transfer_date?: string | null;
  area_id?: string | null;
}
export const bulkEditDevices = (payload: BulkEditPayload): Promise<{ updated: number; errors: string[] }> =>
  api.post('/devices/bulk-edit', payload).then(r => r.data);

export const deviceQrcodeUrl = (id: string): string => `/api/devices/${id}/qrcode`;
export const getPublicDevice = (id: string | undefined): Promise<PublicDevice> => api.get(`/public/device/${id}`).then(r => r.data);

// Public file URLs (no auth required — for QR code scanned pages)
export const publicAttachmentFileUrl = (id: string): string => `/api/public/attachments/${id}/file`;
export const publicTransferAttachmentFileUrl = (id: string): string => `/api/public/transfer-attachments/${id}/file`;
export const publicMaintenanceAttachmentFileUrl = (id: string): string => `/api/public/maintenance-attachments/${id}/file`;

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
export const uploadTransferAttachments = (deviceId: string, files: File[]) => {
  const fd = new FormData();
  files.forEach(f => fd.append('files', f));
  return api.post(`/devices/${deviceId}/transfer/attachments`, fd).then(r => r.data);
};
export const deleteTransferAttachment = (id: string) => api.delete(`/transfer-attachments/${id}`);
export const transferAttachmentFileUrl = (id: string): string => `/api/transfer-attachments/${id}/file`;

// Maintenance API
export const getMaintenanceRecords = (deviceId: string): Promise<MaintenanceRecord[]> => api.get(`/devices/${deviceId}/maintenance`).then(r => r.data);
export const createMaintenanceRecord = (deviceId: string, data: FormData | Record<string, unknown>) => api.post(`/devices/${deviceId}/maintenance`, data).then(r => r.data);
export const updateMaintenanceRecord = (id: string, data: FormData | Record<string, unknown>) => api.put(`/maintenance/${id}`, data).then(r => r.data);
export const deleteMaintenanceRecord = (id: string) => api.delete(`/maintenance/${id}`);
export const getMaintenanceAttachments = (recordId: string) => api.get(`/maintenance/${recordId}/attachments`).then(r => r.data);
export const uploadMaintenanceAttachment = (recordId: string, files: File[]) => {
  const fd = new FormData();
  files.forEach(f => fd.append('files', f));
  return api.post(`/maintenance/${recordId}/attachments`, fd).then(r => r.data);
};
export const deleteMaintenanceAttachment = (id: string) => api.delete(`/maintenance-attachments/${id}`);
export const maintenanceAttachmentUrl = (id: string): string => `/api/maintenance-attachments/${id}/file`;

// Distinct transfer-unit values (device.owned_by) for filter dropdowns
export const getTransferUnits = (): Promise<string[]> => api.get('/devices/transfer-units').then(r => r.data);

// Maintenance schedule (per-device, single row)
export interface MaintenanceSchedule {
  id: string;
  device_id: string;
  interval_days: number;
  notify_days_before: number;
  next_due_at: string;
  last_maintenance_at: string | null;
  last_notified_at: string | null;
}

export interface MaintenanceSchedulePayload {
  interval_days: number;
  notify_days_before: number;
  last_maintenance_at?: string; // YYYY-MM-DD or ISO; omit/empty to use device.createdAt as anchor
}

export const getMaintenanceSchedule = (deviceId: string): Promise<MaintenanceSchedule | null> =>
  api.get(`/devices/${deviceId}/maintenance-schedule`).then(r => r.data).catch((e) => {
    if (e?.response?.status === 404) return null;
    throw e;
  });
export const upsertMaintenanceSchedule = (deviceId: string, payload: MaintenanceSchedulePayload): Promise<MaintenanceSchedule> =>
  api.put(`/devices/${deviceId}/maintenance-schedule`, payload).then(r => r.data);
export const deleteMaintenanceSchedule = (deviceId: string) =>
  api.delete(`/devices/${deviceId}/maintenance-schedule`);

// Maintenance tasks have been merged into MaintenanceRecord (see above).
export type MaintenancePeriod = 'week' | 'month' | 'year' | '';

// Notifications
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  source_type: string | null;
  source_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  unread_count: number;
}

export const getNotifications = (limit = 30): Promise<NotificationListResponse> =>
  api.get('/notifications', { params: { limit } }).then(r => r.data);
export const markNotificationRead = (id: string): Promise<NotificationItem> =>
  api.patch(`/notifications/${id}/read`).then(r => r.data);
export const markAllNotificationsRead = (): Promise<{ updated: number }> =>
  api.post('/notifications/mark-all-read').then(r => r.data);

// Location API
export const getLocations = (): Promise<Location[]> => api.get('/locations').then(r => r.data);

// Export API
export const exportDevicesExcel = (deviceIds: string[]): Promise<Blob> =>
  api.post('/devices/export/excel', { device_ids: deviceIds }, { responseType: 'blob' }).then(r => r.data);
export const exportDevicesExcelFiltered = (params?: DeviceListParams): Promise<Blob> =>
  api.get('/devices/export/excel', { params, responseType: 'blob' }).then(r => r.data);
export const createLocation = (data: { name: string }): Promise<Location> => api.post('/locations', data).then(r => r.data);
export const updateLocationApi = (id: string, data: { name: string }) => api.put(`/locations/${id}`, data).then(r => r.data);
export const deleteLocationApi = (id: string) => api.delete(`/locations/${id}`);

// Area API
export const getAreas = (): Promise<Area[]> => api.get('/areas').then(r => r.data);
export const createArea = (data: { name: string }): Promise<Area> => api.post('/areas', data).then(r => r.data);
export const updateAreaApi = (id: string, data: { name: string }) => api.put(`/areas/${id}`, data).then(r => r.data);
export const deleteAreaApi = (id: string) => api.delete(`/areas/${id}`);

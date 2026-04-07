import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const getDevices = () => api.get('/devices').then(r => r.data);
export const getDevice = (id) => api.get(`/devices/${id}`).then(r => r.data);
export const createDevice = (formData) => api.post('/devices', formData).then(r => r.data);
export const updateDevice = (id, formData) => api.put(`/devices/${id}`, formData).then(r => r.data);
export const deleteDevice = (id) => api.delete(`/devices/${id}`);

export const deviceImageUrl = (id) => `/api/devices/${id}/image`;
export const deviceQrcodeUrl = (id) => `/api/devices/${id}/qrcode`;
export const getPublicDevice = (id) => api.get(`/public/device/${id}`).then(r => r.data);

// Transfer API
export const transferDevice = (id, data) => api.post(`/devices/${id}/transfer`, data).then(r => r.data);
export const getDeviceTransfers = (id) => api.get(`/devices/${id}/transfers`).then(r => r.data);

// Location API
export const getLocations = () => api.get('/locations').then(r => r.data);
export const createLocation = (data) => api.post('/locations', data).then(r => r.data);
export const updateLocationApi = (id, data) => api.put(`/locations/${id}`, data).then(r => r.data);
export const deleteLocationApi = (id) => api.delete(`/locations/${id}`);

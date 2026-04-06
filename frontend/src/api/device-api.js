import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const getDevices = () => api.get('/devices').then(r => r.data);
export const getDevice = (id) => api.get(`/devices/${id}`).then(r => r.data);
export const createDevice = (formData) => api.post('/devices', formData).then(r => r.data);
export const updateDevice = (id, formData) => api.put(`/devices/${id}`, formData).then(r => r.data);
export const deleteDevice = (id) => api.delete(`/devices/${id}`);

export const deviceImageUrl = (id) => `/api/devices/${id}/image`;
export const deviceQrcodeUrl = (id) => `/api/devices/${id}/qrcode`;

import api from './api-client';

export interface SettingsResponse {
  base_url: string;
}

export interface RegenerateResponse {
  updated: number;
  base_url: string;
}

export const getSettingsApi = (): Promise<SettingsResponse> =>
  api.get('/admin/settings').then(r => r.data);

export const updateBaseUrlApi = (base_url: string): Promise<SettingsResponse> =>
  api.put('/admin/settings/base-url', { base_url }).then(r => r.data);

export const regenerateQrCodesApi = (): Promise<RegenerateResponse> =>
  api.post('/admin/settings/regenerate-qrcodes').then(r => r.data);

import api from './api-client';

export interface AuthUser {
  id: string;
  username: string;
  role: 'SADMIN' | 'ADMIN' | 'USER';
  status: string;
}

export interface PermissionMap {
  [module: string]: {
    view: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
  };
}

export interface LoginResponse {
  user: AuthUser;
  permissions: PermissionMap;
}

export const loginApi = (username: string, password: string): Promise<LoginResponse> =>
  api.post('/auth/login', { username, password }).then(r => r.data);

export const logoutApi = () => api.post('/auth/logout');

export const getMeApi = (): Promise<LoginResponse> =>
  api.get('/auth/me').then(r => r.data);

import api from './api-client';

export type PermissionMatrix = Record<string, Record<string, { canView: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean }>>;

export const getPermissions = (): Promise<PermissionMatrix> => api.get('/permissions').then(r => r.data);

export const updateRolePermissions = (role: string, modules: Record<string, { canView?: boolean; canCreate?: boolean; canUpdate?: boolean; canDelete?: boolean }>): Promise<unknown> =>
  api.put(`/permissions/${role}`, modules).then(r => r.data);

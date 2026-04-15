import api from './api-client';

export interface AuditLogItem {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  timestamp: string;
  actor: { id: string; username: string } | null;
}

export interface AuditLogResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const getAuditLogs = (params?: { page?: number; limit?: number; action?: string }): Promise<AuditLogResponse> =>
  api.get('/audit-logs', { params }).then(r => r.data);

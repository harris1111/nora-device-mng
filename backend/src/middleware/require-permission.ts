import { type Request, type Response, type NextFunction } from 'express';
import prisma from '../lib/prisma-client.js';
import type { UserRole } from '../generated/prisma/enums.js';
import { syncPermissionsMatrix } from '../utils/permission-sync.js';

type Action = 'view' | 'create' | 'update' | 'delete' | 'export';

const ACTION_FIELD: Record<Action, 'canView' | 'canCreate' | 'canUpdate' | 'canDelete' | 'canExport'> = {
  view: 'canView',
  create: 'canCreate',
  update: 'canUpdate',
  delete: 'canDelete',
  export: 'canExport',
};

type PermissionEntry = {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
};

let permissionCache: Map<string, PermissionEntry> | null = null;

async function loadPermissions(): Promise<Map<string, PermissionEntry>> {
  await syncPermissionsMatrix();
  const all = await prisma.permission.findMany();
  const map = new Map<string, PermissionEntry>();
  for (const p of all) {
    map.set(`${p.role}:${p.module}`, {
      canView: p.canView,
      canCreate: p.canCreate,
      canUpdate: p.canUpdate,
      canDelete: p.canDelete,
      canExport: p.canExport,
    });
  }
  return map;
}

export function clearPermissionCache(): void {
  permissionCache = null;
}

export function requirePermission(module: string, action: Action) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const role = req.user?.role;
      if (!role) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Super Admin always has full access to all endpoints
      if (role === 'SADMIN') {
        return next();
      }

      if (!permissionCache) {
        permissionCache = await loadPermissions();
      }

      const perm = permissionCache.get(`${role}:${module}`);

      if (!perm || !perm[ACTION_FIELD[action]]) {
        res.status(403).json({ error: 'Forbidden', module, action });
        return;
      }

      next();
    } catch (err) {
      console.error('Permission check error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

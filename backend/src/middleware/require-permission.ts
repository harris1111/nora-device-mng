import { type Request, type Response, type NextFunction } from 'express';
import prisma from '../lib/prisma-client.js';
import type { UserRole } from '../generated/prisma/enums.js';

type Action = 'view' | 'create' | 'update' | 'delete';

const ACTION_FIELD: Record<Action, 'canView' | 'canCreate' | 'canUpdate' | 'canDelete'> = {
  view: 'canView',
  create: 'canCreate',
  update: 'canUpdate',
  delete: 'canDelete',
};

export function requirePermission(module: string, action: Action) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const role = req.user?.role;
      if (!role) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const perm = await prisma.permission.findUnique({
        where: { role_module: { role: role as UserRole, module } },
      });

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

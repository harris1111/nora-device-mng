import { Router, type Request, type Response } from 'express';
import prisma from '../lib/prisma-client.js';
import { requirePermission } from '../middleware/require-permission.js';
import { canEditPermissions } from '../utils/tier-guard.js';
import { logAudit } from '../utils/audit-logger.js';
import type { UserRole } from '../generated/prisma/enums.js';

const router: ReturnType<typeof Router> = Router();

const VALID_ROLES: UserRole[] = ['SADMIN', 'ADMIN', 'USER'];

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
}

// GET /api/permissions — full permission matrix
router.get('/', requirePermission('permissions', 'view'), async (_req: Request, res: Response) => {
  try {
    const permissions = await prisma.permission.findMany({ orderBy: [{ role: 'asc' }, { module: 'asc' }] });
    const matrix: Record<string, Record<string, { canView: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean }>> = {};
    for (const p of permissions) {
      if (!matrix[p.role]) matrix[p.role] = {};
      matrix[p.role][p.module] = { canView: p.canView, canCreate: p.canCreate, canUpdate: p.canUpdate, canDelete: p.canDelete };
    }
    res.json(matrix);
  } catch (err) {
    console.error('List permissions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/permissions/:role — update permissions for a role
router.put('/:role', requirePermission('permissions', 'update'), async (req: Request, res: Response) => {
  try {
    const targetRole = (req.params.role as string).toUpperCase() as UserRole;
    if (!VALID_ROLES.includes(targetRole)) return res.status(400).json({ error: 'Invalid role' });
    if (!canEditPermissions(req.user!.role, targetRole)) return res.status(403).json({ error: 'Cannot edit permissions for this role' });

    const modules = req.body as Record<string, { canView?: boolean; canCreate?: boolean; canUpdate?: boolean; canDelete?: boolean }>;
    if (!modules || typeof modules !== 'object') return res.status(400).json({ error: 'Invalid request body' });

    const updates: Array<{ module: string; canView: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean }> = [];
    for (const [mod, perms] of Object.entries(modules)) {
      if (typeof perms !== 'object' || perms === null) continue;
      updates.push({
        module: mod,
        canView: perms.canView === true,
        canCreate: perms.canCreate === true,
        canUpdate: perms.canUpdate === true,
        canDelete: perms.canDelete === true,
      });
    }

    await prisma.$transaction(
      updates.map((u) =>
        prisma.permission.upsert({
          where: { role_module: { role: targetRole, module: u.module } },
          update: { canView: u.canView, canCreate: u.canCreate, canUpdate: u.canUpdate, canDelete: u.canDelete },
          create: { role: targetRole, module: u.module, canView: u.canView, canCreate: u.canCreate, canUpdate: u.canUpdate, canDelete: u.canDelete },
        })
      )
    );

    await logAudit({
      actorUserId: req.user!.id,
      action: 'permission_update',
      targetType: 'Permission',
      targetId: targetRole,
      metadata: { modules: Object.keys(modules) },
      ip: getClientIp(req),
    });

    // Return updated matrix for this role
    const perms = await prisma.permission.findMany({ where: { role: targetRole }, orderBy: { module: 'asc' } });
    const result: Record<string, { canView: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean }> = {};
    for (const p of perms) {
      result[p.module] = { canView: p.canView, canCreate: p.canCreate, canUpdate: p.canUpdate, canDelete: p.canDelete };
    }
    res.json({ role: targetRole, permissions: result });
  } catch (err) {
    console.error('Update permissions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

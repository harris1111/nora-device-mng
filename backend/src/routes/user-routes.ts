import { Router, type Request, type Response } from 'express';
import prisma from '../lib/prisma-client.js';
import { hashPassword } from '../lib/password-utils.js';
import { requirePermission } from '../middleware/require-permission.js';
import { canManageRole } from '../utils/tier-guard.js';
import { validateUsername, validatePassword } from '../utils/user-validation.js';
import { logAudit } from '../utils/audit-logger.js';
import type { UserRole } from '../generated/prisma/enums.js';

const router: ReturnType<typeof Router> = Router();

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
}

function mapUser(u: { id: string; username: string; role: string; status: string; createdAt: Date; updatedAt: Date }) {
  return { id: u.id, username: u.username, role: u.role, status: u.status, created_at: u.createdAt.toISOString(), updated_at: u.updatedAt.toISOString() };
}

// GET /api/users
router.get('/', requirePermission('users', 'view'), async (req: Request, res: Response) => {
  try {
    const role = req.user!.role;
    const where = role === 'SADMIN' ? {} : { role: 'USER' as UserRole };
    const users = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(users.map(mapUser));
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id
router.get('/:id', requirePermission('users', 'view'), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id as string } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (req.user!.role === 'ADMIN' && user.role !== 'USER') return res.status(404).json({ error: 'User not found' });
    res.json(mapUser(user));
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users
router.post('/', requirePermission('users', 'create'), async (req: Request, res: Response) => {
  try {
    const { username, password, role } = req.body;
    const usernameErr = validateUsername(username);
    if (usernameErr) return res.status(400).json({ error: usernameErr });
    const passwordErr = validatePassword(password);
    if (passwordErr) return res.status(400).json({ error: passwordErr });

    if (!role || !['ADMIN', 'USER'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (role === 'SADMIN') return res.status(403).json({ error: 'Cannot create SADMIN' });
    if (!canManageRole(req.user!.role, role as UserRole)) return res.status(403).json({ error: 'Insufficient permissions for this role' });

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return res.status(409).json({ error: 'Username already exists' });

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { username, passwordHash, role: role as UserRole, createdById: req.user!.id },
    });

    await logAudit({ actorUserId: req.user!.id, action: 'user_create', targetType: 'User', targetId: user.id, metadata: { role }, ip: getClientIp(req) });
    res.status(201).json(mapUser(user));
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id
router.put('/:id', requirePermission('users', 'update'), async (req: Request, res: Response) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id as string } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === 'SADMIN') return res.status(403).json({ error: 'Cannot edit SADMIN' });
    if (!canManageRole(req.user!.role, target.role)) return res.status(403).json({ error: 'Insufficient permissions' });

    const { username } = req.body;
    const usernameErr = validateUsername(username);
    if (usernameErr) return res.status(400).json({ error: usernameErr });

    if (username !== target.username) {
      const dup = await prisma.user.findUnique({ where: { username } });
      if (dup) return res.status(409).json({ error: 'Username already exists' });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data: { username, updatedById: req.user!.id },
    });

    await logAudit({ actorUserId: req.user!.id, action: 'user_update', targetType: 'User', targetId: user.id, metadata: { username }, ip: getClientIp(req) });
    res.json(mapUser(user));
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id/reset-password
router.put('/:id/reset-password', requirePermission('users', 'update'), async (req: Request, res: Response) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id as string } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (!canManageRole(req.user!.role, target.role)) return res.status(403).json({ error: 'Insufficient permissions' });

    const { newPassword } = req.body;
    const passwordErr = validatePassword(newPassword);
    if (passwordErr) return res.status(400).json({ error: passwordErr });

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: req.params.id as string },
      data: { passwordHash, updatedById: req.user!.id },
    });

    await logAudit({ actorUserId: req.user!.id, action: 'user_reset_password', targetType: 'User', targetId: target.id, ip: getClientIp(req) });
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id/status
router.put('/:id/status', requirePermission('users', 'update'), async (req: Request, res: Response) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id as string } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === 'SADMIN') return res.status(403).json({ error: 'Cannot change SADMIN status' });
    if (req.user!.id === target.id) return res.status(400).json({ error: 'Cannot change own status' });
    if (!canManageRole(req.user!.role, target.role)) return res.status(403).json({ error: 'Insufficient permissions' });

    const { status } = req.body;
    if (!status || !['ACTIVE', 'LOCKED'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data: { status, updatedById: req.user!.id },
    });

    await logAudit({ actorUserId: req.user!.id, action: 'user_status_change', targetType: 'User', targetId: target.id, metadata: { status }, ip: getClientIp(req) });
    res.json(mapUser(user));
  } catch (err) {
    console.error('Update user status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', requirePermission('users', 'delete'), async (req: Request, res: Response) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id as string } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === 'SADMIN') return res.status(403).json({ error: 'Cannot delete SADMIN' });
    if (req.user!.id === target.id) return res.status(400).json({ error: 'Cannot delete own account' });
    if (!canManageRole(req.user!.role, target.role)) return res.status(403).json({ error: 'Insufficient permissions' });

    await prisma.user.delete({ where: { id: req.params.id as string } });
    await logAudit({ actorUserId: req.user!.id, action: 'user_delete', targetType: 'User', targetId: target.id, metadata: { username: target.username }, ip: getClientIp(req) });
    res.status(204).send();
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id/change-password (self, authenticated)
router.put('/:id/change-password', async (req: Request, res: Response) => {
  try {
    if (req.user!.id !== req.params.id) return res.status(403).json({ error: 'Can only change own password' });

    const { newPassword } = req.body;
    const passwordErr = validatePassword(newPassword);
    if (passwordErr) return res.status(400).json({ error: passwordErr });

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash },
    });

    await logAudit({ actorUserId: req.user!.id, action: 'password_change', targetType: 'User', targetId: req.user!.id, ip: getClientIp(req) });
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import { Router, type Request, type Response } from 'express';
import prisma from '../lib/prisma-client.js';
import { comparePassword } from '../lib/password-utils.js';
import { signToken, verifyToken } from '../lib/jwt-utils.js';
import { logAudit } from '../utils/audit-logger.js';
import type { UserRole } from '../generated/prisma/enums.js';

const router: ReturnType<typeof Router> = Router();

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
}

async function loadPermissionsMap(role: UserRole) {
  const perms = await prisma.permission.findMany({ where: { role } });
  const map: Record<string, { view: boolean; create: boolean; update: boolean; delete: boolean }> = {};
  for (const p of perms) {
    map[p.module] = { view: p.canView, create: p.canCreate, update: p.canUpdate, delete: p.canDelete };
  }
  return map;
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    const ip = getClientIp(req);

    if (!user) {
      await logAudit({ action: 'login_fail', metadata: { username, reason: 'not_found' }, ip });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (user.status === 'LOCKED') {
      await logAudit({ actorUserId: user.id, action: 'login_fail', metadata: { reason: 'locked' }, ip });
      return res.status(401).json({ error: 'Account is locked' });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      await logAudit({ actorUserId: user.id, action: 'login_fail', metadata: { reason: 'wrong_password' }, ip });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = signToken({ userId: user.id, role: user.role });
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: isProduction,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const permissions = await loadPermissionsMap(user.role);
    await logAudit({ actorUserId: user.id, action: 'login_success', ip });

    res.json({
      user: { id: user.id, username: user.username, role: user.role, status: user.status },
      permissions,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token', { path: '/' });
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.status === 'LOCKED') return res.status(401).json({ error: 'Not authenticated' });

    const permissions = await loadPermissionsMap(user.role);
    res.json({
      user: { id: user.id, username: user.username, role: user.role, status: user.status },
      permissions,
    });
  } catch {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

export default router;

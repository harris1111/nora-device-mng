import { type Request, type Response, type NextFunction } from 'express';
import { verifyToken } from '../lib/jwt-utils.js';
import prisma from '../lib/prisma-client.js';

const AUTH_CACHE_TTL_MS = 30_000;

type CachedUser = { user: { id: string; username: string; role: string }; expires: number };
const authCache = new Map<string, CachedUser>();

export function clearAuthCache(userId?: string): void {
  if (userId) {
    authCache.delete(userId);
  } else {
    authCache.clear();
  }
}

export default async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.token;
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const payload = verifyToken(token);

    const now = Date.now();
    const cached = authCache.get(payload.userId);
    if (cached && cached.expires > now) {
      req.user = cached.user;
      next();
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.status === 'LOCKED') {
      authCache.delete(payload.userId);
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userData = { id: user.id, username: user.username, role: user.role };
    authCache.set(payload.userId, { user: userData, expires: now + AUTH_CACHE_TTL_MS });

    req.user = userData;
    next();
  } catch {
    res.status(401).json({ error: 'Authentication required' });
  }
}

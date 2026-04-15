import { type Request, type Response, type NextFunction } from 'express';
import { verifyToken } from '../lib/jwt-utils.js';
import prisma from '../lib/prisma-client.js';

export default async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.token;
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.status === 'LOCKED') {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    req.user = { id: user.id, username: user.username, role: user.role };
    next();
  } catch {
    res.status(401).json({ error: 'Authentication required' });
  }
}

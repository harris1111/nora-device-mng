import { Router, type Request, type Response } from 'express';
import prisma from '../lib/prisma-client.js';

const router: ReturnType<typeof Router> = Router();

// GET /api/audit-logs — paginated, SADMIN-only
router.get('/', async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'SADMIN') return res.status(403).json({ error: 'SADMIN only' });

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (req.query.action) where.action = req.query.action;
    if (req.query.actorUserId) where.actorUserId = req.query.actorUserId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, username: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const items = logs.map((l) => ({
      id: l.id,
      action: l.action,
      target_type: l.targetType,
      target_id: l.targetId,
      metadata: l.metadata,
      ip: l.ip,
      timestamp: l.createdAt.toISOString(),
      actor: l.actor ? { id: l.actor.id, username: l.actor.username } : null,
    }));

    res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('List audit logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

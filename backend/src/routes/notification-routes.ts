import { Router, type Request, type Response } from 'express';
import prisma from '../lib/prisma-client.js';
import { subscribe, publishToUser } from '../lib/notification-hub.js';
import { mapNotification } from '../lib/notification-service.js';

const router: ReturnType<typeof Router> = Router();

// GET /api/notifications — recent notifications for the current user (newest first)
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 30));
    const items = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const unreadCount = await prisma.notification.count({ where: { userId: req.user!.id, isRead: false } });
    res.json({ items: items.map(mapNotification), unread_count: unreadCount });
  } catch (err) {
    console.error('List notifications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/notifications/:id/read — mark a single notification as read
router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    if (existing.isRead) return res.json(mapNotification(existing));
    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
    publishToUser(req.user!.id, 'notification:read', { id, is_read: true });
    res.json(mapNotification(updated));
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/notifications/mark-all-read — mark all unread for current user
router.post('/mark-all-read', async (req: Request, res: Response) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    publishToUser(req.user!.id, 'notification:read-all', { count: result.count });
    res.json({ updated: result.count });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/notifications/stream — Server-Sent Events stream for the current user
router.get('/stream', (req: Request, res: Response) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  res.write(': connected\n\n');

  const unsubscribe = subscribe(req.user!.id, res);
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* noop */ }
  }, 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

export default router;

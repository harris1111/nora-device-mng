import { Router, type Request, type Response } from 'express';
import prisma from '../lib/prisma-client.js';
import { requirePermission } from '../middleware/require-permission.js';

const router: ReturnType<typeof Router> = Router();

function mapSchedule(s: {
  id: string; deviceId: string; intervalDays: number;
  notifyDaysBefore: number; nextDueAt: Date; lastNotifiedAt: Date | null;
}) {
  return {
    id: s.id,
    device_id: s.deviceId,
    interval_days: s.intervalDays,
    notify_days_before: s.notifyDaysBefore,
    next_due_at: s.nextDueAt.toISOString(),
    last_notified_at: s.lastNotifiedAt?.toISOString() || null,
  };
}

function parseScheduleInput(body: { interval_days?: unknown; notify_days_before?: unknown; next_due_at?: unknown }) {
  const interval = Number(body.interval_days);
  const notify = Number(body.notify_days_before);
  if (!Number.isFinite(interval) || interval < 1) throw new Error('interval_days must be a positive integer');
  if (!Number.isFinite(notify) || notify < 0) throw new Error('notify_days_before must be a non-negative integer');
  if (notify > interval) throw new Error('notify_days_before cannot exceed interval_days');
  if (!body.next_due_at || typeof body.next_due_at !== 'string') throw new Error('next_due_at is required');
  const dueAt = new Date(body.next_due_at);
  if (Number.isNaN(dueAt.getTime())) throw new Error('next_due_at must be a valid ISO date');
  return { intervalDays: Math.floor(interval), notifyDaysBefore: Math.floor(notify), nextDueAt: dueAt };
}

// GET /api/devices/:deviceId/maintenance-schedule
router.get('/devices/:deviceId/maintenance-schedule', requirePermission('maintenance', 'view'), async (req: Request, res: Response) => {
  try {
    const sched = await prisma.scheduledMaintenance.findUnique({ where: { deviceId: req.params.deviceId as string } });
    if (!sched) return res.status(404).json({ error: 'No maintenance schedule' });
    res.json(mapSchedule(sched));
  } catch (err) {
    console.error('Get maintenance schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/devices/:deviceId/maintenance-schedule — upsert
router.put('/devices/:deviceId/maintenance-schedule', requirePermission('maintenance', 'update'), async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId as string;
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    let parsed;
    try { parsed = parseScheduleInput(req.body); }
    catch (e) { return res.status(400).json({ error: (e as Error).message }); }

    const sched = await prisma.scheduledMaintenance.upsert({
      where: { deviceId },
      create: { deviceId, ...parsed, createdById: req.user!.id },
      update: { ...parsed, lastNotifiedAt: null, updatedById: req.user!.id },
    });
    // Setting/changing the schedule resets the maintenance status to 'in_use'
    await prisma.device.update({ where: { id: deviceId }, data: { maintenanceStatus: 'in_use' } });
    res.json(mapSchedule(sched));
  } catch (err) {
    console.error('Upsert maintenance schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/devices/:deviceId/maintenance-schedule
router.delete('/devices/:deviceId/maintenance-schedule', requirePermission('maintenance', 'delete'), async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId as string;
    await prisma.scheduledMaintenance.deleteMany({ where: { deviceId } });
    await prisma.device.update({ where: { id: deviceId }, data: { maintenanceStatus: 'in_use' } });
    res.status(204).send();
  } catch (err) {
    console.error('Delete maintenance schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import { Router, type Request, type Response } from 'express';
import prisma from '../lib/prisma-client.js';
import { requirePermission } from '../middleware/require-permission.js';

const router: ReturnType<typeof Router> = Router();

function mapSchedule(s: {
  id: string; deviceId: string; intervalDays: number;
  notifyDaysBefore: number; nextDueAt: Date; lastInventoryAt: Date | null; lastNotifiedAt: Date | null;
}) {
  return {
    id: s.id,
    device_id: s.deviceId,
    interval_days: s.intervalDays,
    notify_days_before: s.notifyDaysBefore,
    next_due_at: s.nextDueAt.toISOString(),
    last_inventory_at: s.lastInventoryAt?.toISOString() || null,
    last_notified_at: s.lastNotifiedAt?.toISOString() || null,
  };
}

function parseScheduleInput(body: { interval_days?: unknown; notify_days_before?: unknown; last_inventory_at?: unknown }) {
  const interval = Number(body.interval_days);
  const notify = Number(body.notify_days_before);
  if (!Number.isFinite(interval) || interval < 1) throw new Error('interval_days must be a positive integer');
  if (!Number.isFinite(notify) || notify < 0) throw new Error('notify_days_before must be a non-negative integer');
  if (notify > interval) throw new Error('notify_days_before cannot exceed interval_days');
  let lastInventoryAt: Date | null = null;
  if (body.last_inventory_at !== undefined && body.last_inventory_at !== null && body.last_inventory_at !== '') {
    if (typeof body.last_inventory_at !== 'string') throw new Error('last_inventory_at must be an ISO date string');
    const parsed = new Date(body.last_inventory_at);
    if (Number.isNaN(parsed.getTime())) throw new Error('last_inventory_at must be a valid ISO date');
    lastInventoryAt = parsed;
  }
  return { intervalDays: Math.floor(interval), notifyDaysBefore: Math.floor(notify), lastInventoryAt };
}

// GET /api/devices/:deviceId/inventory-schedule
router.get('/devices/:deviceId/inventory-schedule', requirePermission('inventory', 'view'), async (req: Request, res: Response) => {
  try {
    const sched = await prisma.scheduledInventory.findUnique({ where: { deviceId: req.params.deviceId as string } });
    if (!sched) return res.status(404).json({ error: 'No inventory schedule' });
    res.json(mapSchedule(sched));
  } catch (err) {
    console.error('Get inventory schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/devices/:deviceId/inventory-schedule — upsert
router.put('/devices/:deviceId/inventory-schedule', requirePermission('inventory', 'update'), async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId as string;
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    let parsed;
    try { parsed = parseScheduleInput(req.body); }
    catch (e) { return res.status(400).json({ error: (e as Error).message }); }

    const anchor = parsed.lastInventoryAt ?? device.createdAt;
    const nextDueAt = new Date(anchor);
    nextDueAt.setDate(nextDueAt.getDate() + parsed.intervalDays);
    const data = {
      intervalDays: parsed.intervalDays,
      notifyDaysBefore: parsed.notifyDaysBefore,
      lastInventoryAt: parsed.lastInventoryAt,
      nextDueAt,
    };

    const sched = await prisma.scheduledInventory.upsert({
      where: { deviceId },
      create: { deviceId, ...data, createdById: req.user!.id },
      update: { ...data, lastNotifiedAt: null, updatedById: req.user!.id },
    });
    // Setting/changing the schedule resets the inventory status to 'in_use'
    await prisma.device.update({ where: { id: deviceId }, data: { inventoryStatus: 'in_use' } });
    res.json(mapSchedule(sched));
  } catch (err) {
    console.error('Upsert inventory schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/devices/:deviceId/inventory-schedule
router.delete('/devices/:deviceId/inventory-schedule', requirePermission('inventory', 'delete'), async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId as string;
    await prisma.scheduledInventory.deleteMany({ where: { deviceId } });
    await prisma.device.update({ where: { id: deviceId }, data: { inventoryStatus: 'in_use' } });
    res.status(204).send();
  } catch (err) {
    console.error('Delete inventory schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

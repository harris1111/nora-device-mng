/**
 * Polls scheduled_maintenances and performs two independent actions per cycle:
 *
 * 1. Notification (single alert): once `now >= nextDueAt - notifyDaysBefore`
 *    and `last_notified_at IS NULL`, emit a single advance-notice notification
 *    and stamp `last_notified_at` so it never fires twice in a cycle.
 *
 * 2. Strict status enforcement: any schedule whose `next_due_at <= now` MUST
 *    have its device's `maintenance_status = 'needs_maintenance'`. This is
 *    re-applied every poll until a completed maintenance task advances
 *    `next_due_at` (which resets the device back to `in_use`).
 *
 * Runs in-process via setInterval. KISS: for multi-instance deployments a
 * proper job runner / leader election is needed.
 */
import prisma from './prisma-client.js';
import { createNotification } from './notification-service.js';

const POLL_MS = 5 * 60 * 1000; // 5 minutes

async function runOnce(): Promise<void> {
  try {
    const now = new Date();

    // --- 1. Advance-notice notification (single alert per cycle) ---
    const pendingNotify = await prisma.scheduledMaintenance.findMany({
      where: { lastNotifiedAt: null },
      include: { device: { select: { id: true, name: true, storeId: true } } },
    });

    for (const sched of pendingNotify) {
      const threshold = new Date(sched.nextDueAt);
      threshold.setDate(threshold.getDate() - sched.notifyDaysBefore);
      if (now < threshold) continue;

      const dueLabel = sched.nextDueAt.toLocaleDateString('vi-VN');
      await createNotification({
        userId: null, // fan-out to admins
        type: 'maintenance_due',
        title: `Thiết bị cần bảo trì: ${sched.device.name}`,
        message: `Mã ${sched.device.storeId} đến hạn bảo trì ngày ${dueLabel}.`,
        link: `/devices/${sched.device.id}`,
        sourceType: 'device',
        sourceId: sched.device.id,
      });

      await prisma.scheduledMaintenance.update({
        where: { id: sched.id },
        data: { lastNotifiedAt: now },
      });
    }

    // --- 2. Strict status enforcement on/after due date ---
    // Any schedule whose nextDueAt has arrived must mark its device as
    // 'needs_maintenance'. Decoupled from notification: status flips strictly
    // on the due date, regardless of whether a notification was sent earlier.
    // Also flip the user-facing device.status from 'active' -> 'under_repair'
    // (skip devices that are not currently 'active', e.g. decommissioned).
    const overdue = await prisma.scheduledMaintenance.findMany({
      where: {
        nextDueAt: { lte: now },
        OR: [
          { device: { maintenanceStatus: { not: 'needs_maintenance' } } },
          { device: { status: 'active' } },
        ],
      },
      select: { deviceId: true },
    });

    if (overdue.length) {
      const ids = overdue.map((o: { deviceId: string }) => o.deviceId);
      await prisma.device.updateMany({
        where: { id: { in: ids } },
        data: { maintenanceStatus: 'needs_maintenance' },
      });
      // Promote 'active' -> 'under_repair' only; leave other statuses alone.
      await prisma.device.updateMany({
        where: { id: { in: ids }, status: 'active' },
        data: { status: 'under_repair' },
      });
    }
  } catch (err) {
    console.error('Maintenance scheduler error:', err);
  }
}

let timer: NodeJS.Timeout | null = null;

export function startMaintenanceScheduler(): void {
  if (timer) return;
  // Fire once shortly after boot so newly-due items don't wait a full cycle.
  setTimeout(() => { void runOnce(); }, 30_000);
  timer = setInterval(() => { void runOnce(); }, POLL_MS);
}

export function stopMaintenanceScheduler(): void {
  if (timer) { clearInterval(timer); timer = null; }
}

// Exposed so an admin endpoint or test can trigger a synchronous pass.
export { runOnce as runMaintenanceSchedulerOnce };

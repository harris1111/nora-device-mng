/**
 * Polls scheduled_maintenances and fires notifications for entries that have
 * crossed the (next_due_at - notify_days_before) threshold and have not yet
 * been notified for the current cycle (last_notified_at IS NULL).
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
    // notify-window opens at: nextDueAt - notifyDaysBefore <= now
    // Compute on-the-fly per row using a raw filter would need SQL — use JS filter on small set instead.
    const due = await prisma.scheduledMaintenance.findMany({
      where: { lastNotifiedAt: null },
      include: { device: { select: { id: true, name: true, storeId: true } } },
    });

    for (const sched of due) {
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

      await prisma.$transaction([
        prisma.scheduledMaintenance.update({
          where: { id: sched.id },
          data: { lastNotifiedAt: now },
        }),
        prisma.device.update({
          where: { id: sched.device.id },
          data: { maintenanceStatus: 'needs_maintenance' },
        }),
      ]);
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

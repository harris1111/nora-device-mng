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
      include: { device: { select: { id: true, name: true, storeId: true, roomId: true } } },
    });

    // Group by room for batch dedup
    const byRoom = new Map<string, typeof pendingNotify>();
    for (const sched of pendingNotify) {
      const threshold = new Date(sched.nextDueAt);
      threshold.setDate(threshold.getDate() - sched.notifyDaysBefore);
      if (now < threshold) continue;

      const key = sched.device.roomId ?? '_unassigned';
      if (!byRoom.has(key)) byRoom.set(key, []);
      byRoom.get(key)!.push(sched);
    }

    for (const [roomId, scheds] of byRoom) {
      if (roomId === '_unassigned') {
        // Individual notifications (existing behavior)
        for (const sched of scheds) {
          const dueLabel = sched.nextDueAt.toLocaleDateString('vi-VN');
          await createNotification({
            userId: null,
            type: 'maintenance_due',
            title: `Thiết bị cần bảo trì: ${sched.device.name}`,
            message: `Mã ${sched.device.storeId} đến hạn bảo trì ngày ${dueLabel}.`,
            link: `/devices/${sched.device.id}`,
            sourceType: 'device',
            sourceId: sched.device.id,
          });
        }
      } else if (scheds.length === 1) {
        // Single room device → existing per-device notification with device link
        const dueLabel = scheds[0].nextDueAt.toLocaleDateString('vi-VN');
        await createNotification({
          userId: null,
          type: 'maintenance_due',
          title: `Thiết bị cần bảo trì: ${scheds[0].device.name}`,
          message: `Mã ${scheds[0].device.storeId} đến hạn bảo trì ngày ${dueLabel}.`,
          link: `/devices/${scheds[0].device.id}`,
          sourceType: 'device',
          sourceId: scheds[0].device.id,
        });
      } else {
        // Batch notification for multiple overdue in same room.
        // Dedup is inherent: all schedules in this batch will have lastNotifiedAt
        // set below, so the next poll (where lastNotifiedAt: null) won't re-pick them.
        await createNotification({
          userId: null,
          type: 'room_maintenance_overdue',
          title: `${scheds.length} thiết bị cần bảo trì`,
          message: `${scheds.length} thiết bị trong phòng đã đến hạn bảo trì.`,
          link: `/rooms?selected=${roomId}`,
          sourceType: 'room',
          sourceId: roomId,
        });
      }

      // Auto-create pending maintenance records + update lastNotifiedAt
      for (const sched of scheds) {
        const existingPending = await prisma.maintenanceRecord.findFirst({
          where: {
            deviceId: sched.device.id,
            status: 'pending',
            date: sched.nextDueAt,
            recordType: 'maintenance',
          },
          select: { id: true },
        });
        if (!existingPending) {
          await prisma.maintenanceRecord.create({
            data: {
              deviceId: sched.device.id,
              date: sched.nextDueAt,
              description: 'Bảo trì định kỳ (tự động tạo)',
              technician: '',
              status: 'pending',
              recordType: 'maintenance',
            },
          });
        }

        await prisma.scheduledMaintenance.update({
          where: { id: sched.id },
          data: { lastNotifiedAt: now },
        });
      }
    }

    // --- 2. Strict status enforcement on/after due date ---
    // Any schedule whose nextDueAt has arrived must mark its device as
    // 'needs_maintenance'. Decoupled from notification: status flips strictly
    // on the due date, regardless of whether a notification was sent earlier.
    // Maintenance has the highest priority among workflow states, so we
    // promote BOTH 'active' AND 'needs_inventory' to 'under_repair'. Leave
    // 'decommissioned' / other terminal statuses alone.
    const overdue = await prisma.scheduledMaintenance.findMany({
      where: {
        nextDueAt: { lte: now },
        OR: [
          { device: { maintenanceStatus: { not: 'needs_maintenance' } } },
          { device: { status: { in: ['active', 'needs_inventory'] } } },
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
      // Maintenance outranks inventory: lift 'active' and 'needs_inventory'
      // to 'under_repair'. When the maintenance task completes,
      // recomputeDeviceStatus will fall back to 'needs_inventory' if any
      // inventory record is still pending.
      await prisma.device.updateMany({
        where: { id: { in: ids }, status: { in: ['active', 'needs_inventory'] } },
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

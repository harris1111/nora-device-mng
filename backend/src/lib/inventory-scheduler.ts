/**
 * Polls scheduled_inventories and performs two independent actions per cycle:
 *
 * 1. Notification (single alert): once `now >= nextDueAt - notifyDaysBefore`
 *    and `last_notified_at IS NULL`, emit a single advance-notice notification
 *    and stamp `last_notified_at` so it never fires twice in a cycle.
 *
 * 2. Strict status enforcement: any schedule whose `next_due_at <= now` MUST
 *    have its device's `inventory_status = 'needs_inventory'`. This is
 *    re-applied every poll until a completed inventory task advances
 *    `next_due_at` (which resets the device back to `in_use`).
 *
 * Mirrors maintenance-scheduler.ts for the inventory (kiểm kê) workflow.
 */
import prisma from './prisma-client.js';
import { createNotification } from './notification-service.js';

const POLL_MS = 5 * 60 * 1000; // 5 minutes

async function runOnce(): Promise<void> {
  try {
    const now = new Date();

    // --- 1. Advance-notice notification (single alert per cycle) ---
    const pendingNotify = await prisma.scheduledInventory.findMany({
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
        for (const sched of scheds) {
          const dueLabel = sched.nextDueAt.toLocaleDateString('vi-VN');
          await createNotification({
            userId: null,
            type: 'inventory_due',
            title: `Thiết bị cần kiểm kê: ${sched.device.name}`,
            message: `Mã ${sched.device.storeId} đến hạn kiểm kê ngày ${dueLabel}.`,
            link: `/devices/${sched.device.id}`,
            sourceType: 'device',
            sourceId: sched.device.id,
          });
        }
      } else if (scheds.length === 1) {
        const dueLabel = scheds[0].nextDueAt.toLocaleDateString('vi-VN');
        await createNotification({
          userId: null,
          type: 'inventory_due',
          title: `Thiết bị cần kiểm kê: ${scheds[0].device.name}`,
          message: `Mã ${scheds[0].device.storeId} đến hạn kiểm kê ngày ${dueLabel}.`,
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
          type: 'room_inventory_overdue',
          title: `${scheds.length} thiết bị cần kiểm kê`,
          message: `${scheds.length} thiết bị trong phòng đã đến hạn kiểm kê.`,
          link: `/rooms?selected=${roomId}`,
          sourceType: 'room',
          sourceId: roomId,
        });
      }

      // Auto-create pending inventory records + update lastNotifiedAt
      for (const sched of scheds) {
        const existingPending = await prisma.inventoryRecord.findFirst({
          where: {
            deviceId: sched.device.id,
            status: 'pending',
            date: sched.nextDueAt,
          },
          select: { id: true },
        });
        if (!existingPending) {
          await prisma.inventoryRecord.create({
            data: {
              deviceId: sched.device.id,
              date: sched.nextDueAt,
              description: 'Kiểm kê định kỳ (tự động tạo)',
              technician: '',
              status: 'pending',
            },
          });
        }

        await prisma.scheduledInventory.update({
          where: { id: sched.id },
          data: { lastNotifiedAt: now },
        });
      }
    }

    // --- 2. Strict status enforcement on/after due date ---
    // Any schedule whose nextDueAt has arrived must mark its device as
    // 'needs_inventory'. Also flip the user-facing device.status from
    // 'active' -> 'needs_inventory' (skip devices in other statuses).
    const overdue = await prisma.scheduledInventory.findMany({
      where: {
        nextDueAt: { lte: now },
        OR: [
          { device: { inventoryStatus: { not: 'needs_inventory' } } },
          { device: { status: 'active' } },
        ],
      },
      select: { deviceId: true },
    });

    if (overdue.length) {
      const ids = overdue.map((o: { deviceId: string }) => o.deviceId);
      await prisma.device.updateMany({
        where: { id: { in: ids } },
        data: { inventoryStatus: 'needs_inventory' },
      });
      // Promote 'active' -> 'needs_inventory' only; leave other statuses alone
      // (so maintenance 'under_repair' takes precedence — see recomputeDeviceStatus).
      await prisma.device.updateMany({
        where: { id: { in: ids }, status: 'active' },
        data: { status: 'needs_inventory' },
      });
    }
  } catch (err) {
    console.error('Inventory scheduler error:', err);
  }
}

let timer: NodeJS.Timeout | null = null;

export function startInventoryScheduler(): void {
  if (timer) return;
  // Fire once shortly after boot so newly-due items don't wait a full cycle.
  setTimeout(() => { void runOnce(); }, 30_000);
  timer = setInterval(() => { void runOnce(); }, POLL_MS);
}

export function stopInventoryScheduler(): void {
  if (timer) { clearInterval(timer); timer = null; }
}

export { runOnce as runInventorySchedulerOnce };

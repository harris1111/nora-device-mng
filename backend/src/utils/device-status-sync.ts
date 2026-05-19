import prisma from '../lib/prisma-client.js';

// Recompute device.status from pending maintenance + inventory records.
// Priority when multiple workflows are pending:
//   maintenance pending → 'under_repair'
//   else inventory pending → 'needs_inventory'
//   else if currently in a workflow state → 'active'
// Skips decommissioned devices and non-tai_san types.
export async function recomputeDeviceStatus(deviceId: string): Promise<void> {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device || device.type !== 'tai_san') return;
  if (device.status === 'decommissioned') return;

  const [pendingMaintenance, pendingInventory] = await Promise.all([
    prisma.maintenanceRecord.count({ where: { deviceId, status: 'pending' } }),
    prisma.inventoryRecord.count({ where: { deviceId, status: 'pending' } }),
  ]);

  let target: string;
  if (pendingMaintenance > 0) target = 'under_repair';
  else if (pendingInventory > 0) target = 'needs_inventory';
  else target = 'active';

  // Only auto-flip when device is currently in (or transitioning between) workflow states.
  const workflowStates = new Set(['active', 'under_repair', 'needs_inventory']);
  if (!workflowStates.has(device.status)) return;

  if (device.status !== target) {
    await prisma.device.update({ where: { id: deviceId }, data: { status: target } });
  }
}

// Backwards-compatible aliases so existing maintenance call sites keep working.
export const syncDeviceStatusFromMaintenance = recomputeDeviceStatus;
export const syncDeviceStatusFromInventory = recomputeDeviceStatus;

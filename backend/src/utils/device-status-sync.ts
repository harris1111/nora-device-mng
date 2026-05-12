import prisma from '../lib/prisma-client.js';

// Sync device.status against pending maintenance records.
// Rule: if any pending MaintenanceRecord exists for the device,
//   force status='under_repair' (so the device shows as unavailable);
// when none remain pending, revert to 'active'.
// Skips decommissioned devices and non-tai_san types.
export async function syncDeviceStatusFromMaintenance(deviceId: string): Promise<void> {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device || device.type !== 'tai_san') return;
  if (device.status === 'decommissioned') return;

  const pending = await prisma.maintenanceRecord.count({
    where: { deviceId, status: 'pending' },
  });

  if (pending > 0 && device.status !== 'under_repair') {
    await prisma.device.update({ where: { id: deviceId }, data: { status: 'under_repair' } });
  } else if (pending === 0 && device.status === 'under_repair') {
    await prisma.device.update({ where: { id: deviceId }, data: { status: 'active' } });
  }
}

import { PrismaClient } from './src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function seed(): Promise<void> {
  console.log('Seeding database...');

  // Create locations
  const locations = await Promise.all([
    prisma.location.upsert({ where: { name: 'Phòng IT' }, update: {}, create: { name: 'Phòng IT' } }),
    prisma.location.upsert({ where: { name: 'Phòng Kế toán' }, update: {}, create: { name: 'Phòng Kế toán' } }),
    prisma.location.upsert({ where: { name: 'Phòng Kinh doanh' }, update: {}, create: { name: 'Phòng Kinh doanh' } }),
    prisma.location.upsert({ where: { name: 'Kho' }, update: {}, create: { name: 'Kho' } }),
  ]);

  console.log(`Created ${locations.length} locations`);

  // Create sample devices
  const devices = [
    { storeId: 'TS-001', name: 'Laptop Dell Latitude 5540', type: 'tai_san', manufacturer: 'Dell', model: 'Latitude 5540', serialNumber: 'SN-DELL-001', locationId: locations[0].id, ownedBy: 'Phòng IT' },
    { storeId: 'TS-002', name: 'Máy in HP LaserJet Pro', type: 'tai_san', manufacturer: 'HP', model: 'LaserJet Pro M404dn', serialNumber: 'SN-HP-001', locationId: locations[1].id, ownedBy: 'Phòng Kế toán' },
    { storeId: 'CC-001', name: 'Bàn phím Logitech K380', type: 'cong_cu_dung_cu', manufacturer: 'Logitech', model: 'K380', locationId: locations[0].id, ownedBy: 'Phòng IT' },
  ];

  for (const d of devices) {
    await prisma.device.upsert({
      where: { id: d.storeId },
      update: {},
      create: { ...d, status: 'active' },
    });
  }

  console.log(`Created ${devices.length} devices`);
  console.log('Seed completed!');
}

seed()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

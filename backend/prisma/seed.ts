import { PrismaClient, UserRole } from './src/generated/prisma/index.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const MODULES = ['devices', 'locations', 'maintenance', 'attachments', 'transfer', 'users', 'permissions'] as const;

type PermFlags = { canView: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean };
const CRUD: PermFlags = { canView: true, canCreate: true, canUpdate: true, canDelete: true };
const VIEW_ONLY: PermFlags = { canView: true, canCreate: false, canUpdate: false, canDelete: false };
const VIEW_UPDATE: PermFlags = { canView: true, canCreate: false, canUpdate: true, canDelete: false };
const NONE: PermFlags = { canView: false, canCreate: false, canUpdate: false, canDelete: false };

const PERMISSION_MATRIX: Record<UserRole, Record<string, PermFlags>> = {
  SADMIN: { devices: CRUD, locations: CRUD, maintenance: CRUD, attachments: CRUD, transfer: CRUD, users: CRUD, permissions: VIEW_UPDATE },
  ADMIN:  { devices: CRUD, locations: CRUD, maintenance: CRUD, attachments: CRUD, transfer: CRUD, users: CRUD, permissions: VIEW_UPDATE },
  USER:   { devices: VIEW_ONLY, locations: VIEW_ONLY, maintenance: NONE, attachments: NONE, transfer: NONE, users: NONE, permissions: NONE },
};

async function seed(): Promise<void> {
  console.log('Seeding database...');

  // --- SAdmin user ---
  const sadminUser = process.env.SADMIN_USERNAME;
  const sadminPass = process.env.SADMIN_PASSWORD;
  if (!sadminUser || !sadminPass) throw new Error('SADMIN_USERNAME and SADMIN_PASSWORD env vars are required for seeding');

  const hash = await bcrypt.hash(sadminPass, 12);
  await prisma.user.upsert({
    where: { username: sadminUser },
    update: { passwordHash: hash },
    create: { username: sadminUser, passwordHash: hash, role: 'SADMIN', status: 'ACTIVE' },
  });
  console.log(`SAdmin user "${sadminUser}" upserted`);

  // --- Permission matrix ---
  for (const role of Object.values(UserRole)) {
    for (const mod of MODULES) {
      const flags = PERMISSION_MATRIX[role][mod];
      await prisma.permission.upsert({
        where: { role_module: { role, module: mod } },
        update: { ...flags },
        create: { role, module: mod, ...flags },
      });
    }
  }
  console.log(`Permission matrix seeded (${Object.values(UserRole).length} roles × ${MODULES.length} modules)`);

  // --- Locations ---
  const locations = await Promise.all([
    prisma.location.upsert({ where: { name: 'Phòng IT' }, update: {}, create: { name: 'Phòng IT' } }),
    prisma.location.upsert({ where: { name: 'Phòng Kế toán' }, update: {}, create: { name: 'Phòng Kế toán' } }),
    prisma.location.upsert({ where: { name: 'Phòng Kinh doanh' }, update: {}, create: { name: 'Phòng Kinh doanh' } }),
    prisma.location.upsert({ where: { name: 'Kho' }, update: {}, create: { name: 'Kho' } }),
  ]);
  console.log(`Created ${locations.length} locations`);

  // --- Sample devices ---
  const devices = [
    { storeId: 'TS-001', name: 'Laptop Dell Latitude 5540', type: 'tai_san', manufacturer: 'Dell', model: 'Latitude 5540', serialNumber: 'SN-DELL-001', locationId: locations[0].id, ownedBy: 'Phòng IT' },
    { storeId: 'TS-002', name: 'Máy in HP LaserJet Pro', type: 'tai_san', manufacturer: 'HP', model: 'LaserJet Pro M404dn', serialNumber: 'SN-HP-001', locationId: locations[1].id, ownedBy: 'Phòng Kế toán' },
    { storeId: 'CC-001', name: 'Bàn phím Logitech K380', type: 'cong_cu_dung_cu', manufacturer: 'Logitech', model: 'K380', locationId: locations[0].id, ownedBy: 'Phòng IT' },
  ];
  for (const d of devices) {
    await prisma.device.upsert({ where: { id: d.storeId }, update: {}, create: { ...d, status: 'active' } });
  }
  console.log(`Created ${devices.length} devices`);
  console.log('Seed completed!');
}

seed()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { UserRole } from '../src/generated/prisma/enums.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL']! });
// @ts-expect-error Prisma 7 adapter constructor
const prisma = new PrismaClient({ adapter });

const MODULES = ['devices', 'locations', 'areas', 'system_categories', 'rooms', 'maintenance', 'maintenance_history', 'inventory', 'inventory_history', 'attachments', 'transfer', 'users', 'permissions'] as const;

type PermFlags = { canView: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean; canExport: boolean };
const CRUD: PermFlags = { canView: true, canCreate: true, canUpdate: true, canDelete: true, canExport: true };
const VIEW_ONLY: PermFlags = { canView: true, canCreate: false, canUpdate: false, canDelete: false, canExport: false };
const VIEW_UPDATE: PermFlags = { canView: true, canCreate: false, canUpdate: true, canDelete: false, canExport: false };
const NONE: PermFlags = { canView: false, canCreate: false, canUpdate: false, canDelete: false, canExport: false };

const PERMISSION_MATRIX: Record<UserRole, Record<string, PermFlags>> = {
  SADMIN: { devices: CRUD, locations: CRUD, areas: CRUD, system_categories: CRUD, rooms: CRUD, maintenance: CRUD, maintenance_history: CRUD, inventory: CRUD, inventory_history: CRUD, attachments: CRUD, transfer: CRUD, users: CRUD, permissions: VIEW_UPDATE },
  ADMIN:  { devices: CRUD, locations: CRUD, areas: CRUD, system_categories: CRUD, rooms: CRUD, maintenance: CRUD, maintenance_history: CRUD, inventory: CRUD, inventory_history: CRUD, attachments: CRUD, transfer: CRUD, users: CRUD, permissions: VIEW_UPDATE },
  USER:   { devices: VIEW_ONLY, locations: VIEW_ONLY, areas: VIEW_ONLY, system_categories: VIEW_ONLY, rooms: VIEW_ONLY, maintenance: NONE, maintenance_history: NONE, inventory: NONE, inventory_history: NONE, attachments: NONE, transfer: NONE, users: NONE, permissions: NONE },
};

async function seed(): Promise<void> {
  console.log('Checking if database has already been seeded...');

  // Guard: skip seeding if already done
  const isSeeded = await prisma.setting.findUnique({ where: { key: 'database_seeded' } });
  if (isSeeded && isSeeded.value === 'true') {
    console.log('Database already seeded. Skipping seeding.');
    return;
  }

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

  // --- Areas ---
  const areas = await Promise.all([
    prisma.area.upsert({ where: { name: 'Khu A' }, update: {}, create: { name: 'Khu A' } }),
    prisma.area.upsert({ where: { name: 'Khu B' }, update: {}, create: { name: 'Khu B' } }),
    prisma.area.upsert({ where: { name: 'Tầng 1' }, update: {}, create: { name: 'Tầng 1' } }),
    prisma.area.upsert({ where: { name: 'Tầng 2' }, update: {}, create: { name: 'Tầng 2' } }),
  ]);
  console.log(`Created ${areas.length} areas`);

  // --- System Categories ---
  const defaultCategories = [
    'Hệ thống Bơm / Cấp thoát nước',
    'Hệ thống MEP / Kỹ thuật',
    'Hệ thống PCCC',
    'Hệ thống HVAC',
    'Hệ thống Điện',
    'Phần mềm',
    'Phần cứng',
    'Mạng',
    'Khác',
  ];
  const systemCategories = await Promise.all(
    defaultCategories.map((name) =>
      prisma.systemCategory.upsert({ where: { name }, update: {}, create: { name } })
    )
  );
  console.log(`Created ${systemCategories.length} system categories`);

  // --- Sample devices ---
  const devices = [
    { storeId: 'TS-001', name: 'Laptop Dell Latitude 5540', type: 'tai_san', manufacturer: 'Dell', model: 'Latitude 5540', serialNumber: 'SN-DELL-001', locationId: locations[0].id, ownedBy: 'Phòng IT' },
    { storeId: 'TS-002', name: 'Máy in HP LaserJet Pro', type: 'tai_san', manufacturer: 'HP', model: 'LaserJet Pro M404dn', serialNumber: 'SN-HP-001', locationId: locations[1].id, ownedBy: 'Phòng Kế toán' },
    { storeId: 'CC-001', name: 'Bàn phím Logitech K380', type: 'cong_cu_dung_cu', manufacturer: 'Logitech', model: 'K380', locationId: locations[0].id, ownedBy: 'Phòng IT' },
  ];
  let createdCount = 0;
  let updatedCount = 0;
  for (const d of devices) {
    const updated = await prisma.device.updateMany({
      where: { storeId: d.storeId },
      data: { ...d, status: 'active' },
    });

    if (updated.count === 0) {
      await prisma.device.create({ data: { ...d, status: 'active' } });
      createdCount += 1;
    } else {
      updatedCount += updated.count;
    }
  }
  console.log(`Seeded devices (${createdCount} created, ${updatedCount} updated)`);

  // Mark database as seeded so subsequent runs skip
  await prisma.setting.upsert({
    where: { key: 'database_seeded' },
    update: { value: 'true' },
    create: { key: 'database_seeded', value: 'true' },
  });
  console.log('Seed completed successfully!');
}

seed()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

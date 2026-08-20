import prisma from '../lib/prisma-client.js';
import type { UserRole } from '../generated/prisma/enums.js';

export const ALL_MODULES = [
  'devices',
  'locations',
  'areas',
  'system_categories',
  'rooms',
  'maintenance',
  'maintenance_history',
  'inventory',
  'inventory_history',
  'attachments',
  'transfer',
  'users',
  'permissions',
] as const;

type PermFlags = { canView: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean; canExport: boolean };
const CRUD: PermFlags = { canView: true, canCreate: true, canUpdate: true, canDelete: true, canExport: true };
const VIEW_ONLY: PermFlags = { canView: true, canCreate: false, canUpdate: false, canDelete: false, canExport: false };
const VIEW_UPDATE: PermFlags = { canView: true, canCreate: false, canUpdate: true, canDelete: false, canExport: false };
const NONE: PermFlags = { canView: false, canCreate: false, canUpdate: false, canDelete: false, canExport: false };

const DEFAULT_MATRIX: Record<UserRole, Record<string, PermFlags>> = {
  SADMIN: {
    devices: CRUD, locations: CRUD, areas: CRUD, system_categories: CRUD, rooms: CRUD,
    maintenance: CRUD, maintenance_history: CRUD, inventory: CRUD, inventory_history: CRUD,
    attachments: CRUD, transfer: CRUD, users: CRUD, permissions: VIEW_UPDATE,
  },
  ADMIN: {
    devices: CRUD, locations: CRUD, areas: CRUD, system_categories: CRUD, rooms: CRUD,
    maintenance: CRUD, maintenance_history: CRUD, inventory: CRUD, inventory_history: CRUD,
    attachments: CRUD, transfer: CRUD, users: CRUD, permissions: VIEW_UPDATE,
  },
  USER: {
    devices: VIEW_ONLY, locations: VIEW_ONLY, areas: VIEW_ONLY, system_categories: VIEW_ONLY, rooms: VIEW_ONLY,
    maintenance: NONE, maintenance_history: NONE, inventory: NONE, inventory_history: NONE,
    attachments: NONE, transfer: NONE, users: NONE, permissions: NONE,
  },
};

export async function syncPermissionsMatrix(): Promise<void> {
  try {
    const existing = await prisma.permission.findMany();
    const existingKeys = new Set(existing.map((p) => `${p.role}:${p.module}`));

    const upserts: Promise<unknown>[] = [];

    // Guarantee every role + module pair exists
    for (const role of ['SADMIN', 'ADMIN', 'USER'] as UserRole[]) {
      for (const mod of ALL_MODULES) {
        const key = `${role}:${mod}`;
        const defaultFlags = DEFAULT_MATRIX[role]?.[mod] || NONE;

        if (!existingKeys.has(key)) {
          upserts.push(
            prisma.permission.create({
              data: {
                role,
                module: mod,
                ...defaultFlags,
              },
            })
          );
        } else if (role === 'SADMIN') {
          // Guarantee SADMIN always has full access for all modules
          const sadminFlags = DEFAULT_MATRIX.SADMIN[mod] || CRUD;
          const current = existing.find((p) => p.role === 'SADMIN' && p.module === mod);
          if (
            current &&
            (current.canView !== sadminFlags.canView ||
              current.canCreate !== sadminFlags.canCreate ||
              current.canUpdate !== sadminFlags.canUpdate ||
              current.canDelete !== sadminFlags.canDelete)
          ) {
            upserts.push(
              prisma.permission.update({
                where: { role_module: { role: 'SADMIN', module: mod } },
                data: sadminFlags,
              })
            );
          }
        }
      }
    }

    if (upserts.length > 0) {
      await prisma.$transaction(upserts as any);
    }
  } catch (err) {
    console.error('Failed to sync permissions matrix:', err);
  }
}

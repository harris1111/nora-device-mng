import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma-client.js';
import { mapDevice } from '../utils/response-mapper.js';
import { generateQrCode } from '../utils/qrcode-generator.js';
import { getEffectiveBaseUrl } from '../lib/settings.js';
import { syncDeviceTransferRecord } from '../utils/transfer-records.js';
import { validateTypeStatus, applyDateStatusRules, type StatusData } from '../utils/device-status-rules.js';
import { requirePermission } from '../middleware/require-permission.js';

const router: ReturnType<typeof Router> = Router();

type RoomNodeSummary = {
  id: string;
  name: string;
  location_id: string;
  location_name: string;
  parent_id: string | null;
  breadcrumb: string;
  device_count: number;
  descendant_device_count: number;
  status: string;
  has_children: boolean;
  is_leaf: boolean;
  created_at: string;
};

type RoomTreeNode = RoomNodeSummary & { children: RoomTreeNode[] };

const BREADCRUMB_DELIMITER = ' -> ';

// Get allowed location IDs for the current user. Unlike device routes,
// room access never falls back to transferTo — only assigned locations apply.
async function getUserRoomLocationIds(req: Request): Promise<string[] | null> {
  if (req.user!.role !== 'USER') return null;
  const assignments = await prisma.userLocation.findMany({
    where: { userId: req.user!.id },
    select: { locationId: true },
  });
  const ids = assignments.map(a => a.locationId);
  return ids.length > 0 ? ids : ['__NO_LOCATIONS__']; // empty guard
}

// Build breadcrumb by walking up parent chain
async function buildBreadcrumb(node: { id: string; name: string; parentId: string | null }): Promise<string> {
  const parts: string[] = [node.name];
  let currentId = node.parentId;
  const visited = new Set<string>([node.id]);
  while (currentId) {
    if (visited.has(currentId)) break; // cycle guard
    visited.add(currentId);
    const parent = await prisma.roomNode.findUnique({ where: { id: currentId }, select: { id: true, name: true, parentId: true } });
    if (!parent) break;
    parts.unshift(parent.name);
    currentId = parent.parentId;
  }
  return parts.join(BREADCRUMB_DELIMITER);
}

// Build breadcrumb for a room by ID (convenience wrapper)
async function buildBreadcrumbForRoom(roomId: string): Promise<string> {
  const node = await prisma.roomNode.findUnique({ where: { id: roomId }, select: { id: true, name: true, parentId: true } });
  if (!node) return '';
  return buildBreadcrumb(node);
}

// Find-or-create an Area whose name matches the given breadcrumb path, return its id
async function resolveAreaForBreadcrumb(breadcrumb: string, tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<string> {
  const db = tx ?? prisma;
  let area = await (db as typeof prisma).area.findFirst({ where: { name: breadcrumb } });
  if (!area) {
    area = await (db as typeof prisma).area.create({ data: { id: uuidv4(), name: breadcrumb } });
  }
  return area.id;
}

// Recursively sync areaId for all devices in a room and its descendants
async function syncRoomDevicesArea(roomId: string, tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<void> {
  const stack = [roomId];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    const breadcrumb = await buildBreadcrumbForRoom(currentId);
    if (breadcrumb) {
      const areaId = await resolveAreaForBreadcrumb(breadcrumb, tx);
      await (tx as typeof prisma).device.updateMany({ where: { roomId: currentId }, data: { areaId } });
    }
    const children = await (tx as typeof prisma).roomNode.findMany({ where: { parentId: currentId }, select: { id: true } });
    for (const child of children) stack.push(child.id);
  }
}

// Compute descendant device count and maintenance-derived status via recursive descent
async function computeDescendantSummary(roomId: string): Promise<{ descendantDeviceCount: number; status: string }> {
  const stack = [roomId];
  let descendantDeviceCount = 0;
  let needsMaintenance = false;

  while (stack.length > 0) {
    const currentId = stack.pop()!;
    const children = await prisma.roomNode.findMany({
      where: { parentId: currentId },
      select: { id: true, devices: { select: { maintenanceStatus: true } } },
    });
    for (const child of children) {
      stack.push(child.id);
      for (const d of child.devices) {
        descendantDeviceCount += 1;
        if (d.maintenanceStatus === 'needs_maintenance') needsMaintenance = true;
      }
    }
    if (currentId === roomId) {
      const directDevices = await prisma.device.findMany({
        where: { roomId: currentId },
        select: { maintenanceStatus: true },
      });
      for (const d of directDevices) {
        descendantDeviceCount += 1;
        if (d.maintenanceStatus === 'needs_maintenance') needsMaintenance = true;
      }
    }
  }
  return { descendantDeviceCount, status: needsMaintenance ? 'needs_maintenance' : 'in_use' };
}

async function mapRoomSummary(node: {
  id: string;
  name: string;
  locationId: string;
  location?: { name: string } | null;
  parentId: string | null;
  createdAt: Date;
  _count?: { devices?: number; children?: number };
}): Promise<RoomNodeSummary> {
  const deviceCount = node._count?.devices ?? 0;
  const childCount = node._count?.children ?? 0;
  const { descendantDeviceCount, status } = await computeDescendantSummary(node.id);
  const breadcrumb = await buildBreadcrumb({ id: node.id, name: node.name, parentId: node.parentId });
  return {
    id: node.id,
    name: node.name,
    location_id: node.locationId,
    location_name: node.location?.name ?? '',
    parent_id: node.parentId,
    breadcrumb,
    device_count: deviceCount,
    descendant_device_count: descendantDeviceCount,
    status,
    has_children: childCount > 0,
    is_leaf: childCount === 0,
    created_at: node.createdAt.toISOString(),
  };
}

// GET /api/rooms — flat list for selectors/search
router.get('/', requirePermission('rooms', 'view'), async (req: Request, res: Response) => {
  try {
    const allowedLocations = await getUserRoomLocationIds(req);
    const where: Record<string, unknown> = {};
    if (allowedLocations) where.locationId = { in: allowedLocations };

    const rooms = await prisma.roomNode.findMany({
      where,
      include: {
        location: { select: { name: true } },
        _count: { select: { devices: true, children: true } },
      },
      orderBy: { name: 'asc' },
    });

    const summaries = await Promise.all(rooms.map(mapRoomSummary));
    res.json(summaries);
  } catch (err) {
    console.error('List rooms error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rooms/tree — full nested tree
router.get('/tree', requirePermission('rooms', 'view'), async (req: Request, res: Response) => {
  try {
    const allowedLocations = await getUserRoomLocationIds(req);
    const where: Record<string, unknown> = { parentId: null };
    if (allowedLocations) where.locationId = { in: allowedLocations };

    const roots = await prisma.roomNode.findMany({
      where,
      include: {
        location: { select: { name: true } },
        _count: { select: { devices: true, children: true } },
      },
      orderBy: { name: 'asc' },
    });

    async function buildTree(nodes: typeof roots): Promise<RoomTreeNode[]> {
      const tree: RoomTreeNode[] = [];
      for (const node of nodes) {
        const children = await prisma.roomNode.findMany({
          where: { parentId: node.id },
          include: {
            location: { select: { name: true } },
            _count: { select: { devices: true, children: true } },
          },
          orderBy: { name: 'asc' },
        });
        const summary = await mapRoomSummary(node);
        tree.push({ ...summary, children: await buildTree(children) });
      }
      return tree;
    }

    res.json(await buildTree(roots));
  } catch (err) {
    console.error('Room tree error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rooms/:id — room detail
router.get('/:id', requirePermission('rooms', 'view'), async (req: Request, res: Response) => {
  try {
    const node = await prisma.roomNode.findUnique({
      where: { id: req.params.id as string },
      include: {
        location: { select: { name: true } },
        _count: { select: { devices: true, children: true } },
      },
    });
    if (!node) return res.status(404).json({ error: 'Room not found' });

    const allowedLocations = await getUserRoomLocationIds(req);
    if (allowedLocations && !allowedLocations.includes(node.locationId)) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(await mapRoomSummary(node));
  } catch (err) {
    console.error('Get room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify parentId has no direct devices (leaf-only invariant: parent with devices can't have children)
async function validateParentLeafInvariant(parentId: string): Promise<string | null> {
  const deviceCount = await prisma.device.count({ where: { roomId: parentId } });
  if (deviceCount > 0) return 'Cannot add child room to a room that has direct devices';
  return null;
}

// Cycle check: proposed parent must not be a descendant of childId
async function wouldCreateCycle(childId: string, proposedParentId: string): Promise<boolean> {
  let current: string | null = proposedParentId;
  const visited = new Set<string>();
  while (current) {
    if (current === childId) return true;
    if (visited.has(current)) return true;
    visited.add(current);
    const parent: { parentId: string | null } | null = await prisma.roomNode.findUnique({ where: { id: current }, select: { parentId: true } });
    current = parent?.parentId ?? null;
  }
  return false;
}

// POST /api/rooms — create node
router.post('/', requirePermission('rooms', 'create'), async (req: Request, res: Response) => {
  try {
    const { name, location_id, parent_id } = req.body as { name?: string; location_id?: string; parent_id?: string | null };
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (name.trim().length > 255) return res.status(400).json({ error: 'Name too long (max 255 chars)' });
    if (!location_id?.trim()) return res.status(400).json({ error: 'Location is required' });

    const location = await prisma.location.findUnique({ where: { id: location_id.trim() } });
    if (!location) return res.status(400).json({ error: 'Invalid location' });

    let resolvedParentId: string | null = null;
    if (parent_id && parent_id.trim()) {
      const parent = await prisma.roomNode.findUnique({ where: { id: parent_id.trim() } });
      if (!parent) return res.status(400).json({ error: 'Parent room not found' });
      if (parent.locationId !== location_id.trim()) {
        return res.status(400).json({ error: 'Parent room must belong to the same location' });
      }
      resolvedParentId = parent.id;
    }

    // Check USER location scope
    const allowedLocations = await getUserRoomLocationIds(req);
    if (allowedLocations && !allowedLocations.includes(location_id.trim())) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const node = await prisma.$transaction(async (tx) => {
      if (resolvedParentId) {
        const violation = await validateParentLeafInvariant(resolvedParentId);
        if (violation) throw new Error(violation);
      }
      return tx.roomNode.create({
        data: {
          id: uuidv4(),
          name: name.trim(),
          locationId: location_id.trim(),
          parentId: resolvedParentId,
          createdById: req.user!.id,
        },
        include: {
          location: { select: { name: true } },
          _count: { select: { devices: true, children: true } },
        },
      });
    });

    res.status(201).json(await mapRoomSummary(node));
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg.includes('Cannot add child')) return res.status(409).json({ error: msg });
    console.error('Create room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/rooms/:id — rename or move
router.put('/:id', requirePermission('rooms', 'update'), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.roomNode.findUnique({
      where: { id: req.params.id as string },
      select: { id: true, locationId: true },
    });
    if (!existing) return res.status(404).json({ error: 'Room not found' });

    const allowedLocations = await getUserRoomLocationIds(req);
    if (allowedLocations && !allowedLocations.includes(existing.locationId)) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const { name, parent_id } = req.body as { name?: string; parent_id?: string | null };
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (name.trim().length > 255) return res.status(400).json({ error: 'Name too long (max 255 chars)' });

    const updateData: Record<string, unknown> = { name: name.trim(), updatedById: req.user!.id };

    let resolvedParentId: string | null | undefined;
    if (parent_id !== undefined) {
      if (parent_id === null || parent_id === '') {
        resolvedParentId = null;
      } else {
        const parent = await prisma.roomNode.findUnique({ where: { id: parent_id.trim() } });
        if (!parent) return res.status(400).json({ error: 'Parent room not found' });
        if (parent.locationId !== existing.locationId) {
          return res.status(400).json({ error: 'Parent room must belong to the same location' });
        }
        if (parent.id === existing.id) return res.status(400).json({ error: 'A room cannot be its own parent' });
        resolvedParentId = parent.id;
      }
    }

    const nameChanged = name.trim() !== (await prisma.roomNode.findUnique({ where: { id: req.params.id as string }, select: { name: true } }))?.name;
    const parentChanged = resolvedParentId !== undefined;

    await prisma.$transaction(async (tx) => {
      if (resolvedParentId !== undefined && resolvedParentId !== null) {
        if (await wouldCreateCycle(req.params.id as string, resolvedParentId)) {
          throw new Error('Cycle detected: room cannot be placed under its own descendant');
        }
        const violation = await validateParentLeafInvariant(resolvedParentId);
        if (violation) throw new Error(violation);
      }
      if (resolvedParentId !== undefined) {
        updateData.parentId = resolvedParentId;
      }
      await tx.roomNode.update({ where: { id: req.params.id as string }, data: updateData });

      // If name or parent changed, re-sync area paths for this room and all descendants
      if (nameChanged || parentChanged) {
        await syncRoomDevicesArea(req.params.id as string, tx);
      }
    });

    const node = await prisma.roomNode.findUnique({
      where: { id: req.params.id as string },
      include: {
        location: { select: { name: true } },
        _count: { select: { devices: true, children: true } },
      },
    });
    res.json(await mapRoomSummary(node!));
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg.includes('Cycle') || msg.includes('Cannot add')) return res.status(409).json({ error: msg });
    console.error('Update room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/rooms/:id — block if has children or direct devices
router.delete('/:id', requirePermission('rooms', 'delete'), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.roomNode.findUnique({
      where: { id: req.params.id as string },
      include: {
        _count: { select: { devices: true, children: true } },
      },
    });
    if (!existing) return res.status(404).json({ error: 'Room not found' });

    const allowedLocations = await getUserRoomLocationIds(req);
    if (allowedLocations && !allowedLocations.includes(existing.locationId)) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const childCount = existing._count?.children ?? 0;
    const deviceCount = existing._count?.devices ?? 0;
    if (childCount > 0) return res.status(409).json({ error: 'Cannot delete room: it still has child rooms' });
    if (deviceCount > 0) return res.status(409).json({ error: 'Cannot delete room: it still has devices assigned' });

    await prisma.roomNode.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (err) {
    console.error('Delete room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rooms/:roomId/devices — list devices in a room
router.get('/:roomId/devices', requirePermission('rooms', 'view'), async (req: Request, res: Response) => {
  try {
    const room = await prisma.roomNode.findUnique({
      where: { id: req.params.roomId as string },
      select: { id: true, locationId: true },
    });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const allowedLocations = await getUserRoomLocationIds(req);
    if (allowedLocations && !allowedLocations.includes(room.locationId)) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const devices = await prisma.device.findMany({
      where: { roomId: req.params.roomId as string },
      include: {
        location: true,
        area: true,
        attachments: { where: { isPrimary: true }, select: { id: true, isPrimary: true }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(devices.map(mapDevice));
  } catch (err) {
    console.error('List room devices error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/rooms/:roomId/devices — create device in a room
router.post('/:roomId/devices', requirePermission('rooms', 'create'), async (req: Request, res: Response) => {
  try {
    const room = await prisma.roomNode.findUnique({
      where: { id: req.params.roomId as string },
      select: { id: true, locationId: true, _count: { select: { children: true } } },
    });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room._count.children > 0) return res.status(409).json({ error: 'Cannot add device to a room that has child rooms' });

    const allowedLocations = await getUserRoomLocationIds(req);
    if (allowedLocations && !allowedLocations.includes(room.locationId)) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const { name, store_id, area_id, managed_by, serial_number, model: deviceModel, manufacturer, description, type, status, warranty_period } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!store_id?.trim()) return res.status(400).json({ error: 'Store ID is required' });

    let resolvedAreaId: string | null = null;
    if (area_id && typeof area_id === 'string' && area_id.trim()) {
      const area = await prisma.area.findUnique({ where: { id: area_id.trim() } });
      if (!area) return res.status(400).json({ error: 'Invalid area selected' });
      resolvedAreaId = area.id;
    }

    const deviceType = type || 'tai_san';
    const deviceStatus = status || 'active';
    const typeErr = validateTypeStatus(deviceType, deviceStatus);
    if (typeErr) return res.status(400).json({ error: typeErr });

    let statusData: StatusData = {
      type: deviceType,
      status: deviceStatus,
      disposalDate: null,
      lossDate: null,
    };
    statusData = applyDateStatusRules(deviceType, statusData);

    // Auto-populate area from room breadcrumb
    const roomBreadcrumb = await buildBreadcrumbForRoom(room.id);
    let roomAreaId: string | null = null;
    if (roomBreadcrumb) {
      roomAreaId = await resolveAreaForBreadcrumb(roomBreadcrumb);
    }

    const id = uuidv4();
    const baseUrl = await getEffectiveBaseUrl();
    const qrcode = await generateQrCode(id, baseUrl);

    const created = await prisma.$transaction(async (tx) => {
      return tx.device.create({
        data: {
          id,
          storeId: store_id.trim(),
          name: name.trim(),
          locationId: room.locationId,
          roomId: room.id,
          areaId: roomAreaId ?? resolvedAreaId,
          managedBy: managed_by?.trim() || '',
          serialNumber: serial_number?.trim() || '',
          model: deviceModel?.trim() || '',
          manufacturer: manufacturer?.trim() || '',
          description: description?.trim() || '',
          qrcode: new Uint8Array(qrcode),
          type: statusData.type,
          status: statusData.status,
          warrantyPeriod: warranty_period?.trim() || null,
          createdById: req.user!.id,
        },
        include: {
          location: true,
          area: true,
          attachments: { where: { isPrimary: true }, select: { id: true, isPrimary: true }, take: 1 },
        },
      });
    });

    res.status(201).json(mapDevice(created));
  } catch (err) {
    console.error('Create room device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const DEVICE_CLONE_ALLOWLIST: (keyof typeof prisma.device.fields)[] = [
  'storeId', 'name', 'areaId', 'managedBy', 'serialNumber', 'model',
  'manufacturer', 'description', 'type', 'status', 'disposalDate', 'lossDate',
  'warrantyPeriod', 'maintenanceStatus', 'inventoryStatus', 'locationId', 'roomId',
];

// POST /api/rooms/:id/duplicate — clone room subtree and devices
router.post('/:id/duplicate', requirePermission('rooms', 'create'), async (req: Request, res: Response) => {
  try {
    const source = await prisma.roomNode.findUnique({
      where: { id: req.params.id as string },
      include: { _count: { select: { children: true } } },
    });
    if (!source) return res.status(404).json({ error: 'Room not found' });

    // Only leaf child nodes can be duplicated
    if (!source.parentId) {
      return res.status(400).json({ error: 'Chỉ phòng con cuối cùng (lá) mới có thể nhân bản. Phòng gốc không được phép nhân bản.' });
    }
    if (source._count.children > 0) {
      return res.status(400).json({ error: 'Chỉ phòng con cuối cùng (lá) mới có thể nhân bản. Phòng này có phòng con.' });
    }

    const allowedLocations = await getUserRoomLocationIds(req);
    if (allowedLocations && !allowedLocations.includes(source.locationId)) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const { prefix = '', start, end, list, mode = 'range' } = req.body as {
      prefix?: string;
      start?: number;
      end?: number;
      list?: string;
      mode?: 'range' | 'list';
    };

    // Build suffixes from either range or list mode
    let suffixes: string[] = [];
    if (mode === 'list' && list) {
      suffixes = list.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      if (suffixes.length === 0) return res.status(400).json({ error: 'Danh sách phòng không hợp lệ' });
      if (suffixes.length > 50) return res.status(400).json({ error: 'Tối đa 50 phòng mỗi lần nhân bản' });
    } else {
      const s = start ?? 1;
      const e = end ?? 1;
      if (s < 1 || e < s || e > 50) {
        return res.status(400).json({ error: 'Invalid range (1–50)' });
      }
      for (let i = s; i <= e; i++) {
        suffixes.push(i.toString().padStart(String(e).length, '0'));
      }
    }

    async function collectSubtree(rootId: string): Promise<{ node: { id: string; name: string; locationId: string }; children: string[] }[]> {
      const rows: { node: { id: string; name: string; locationId: string }; children: string[] }[] = [];
      const stack = [rootId];
      while (stack.length > 0) {
        const currentId = stack.pop()!;
        const node = await prisma.roomNode.findUnique({
          where: { id: currentId },
          select: { id: true, name: true, locationId: true, parentId: true },
        });
        if (!node) continue;
        const kids = await prisma.roomNode.findMany({ where: { parentId: currentId }, select: { id: true } });
        rows.push({ node, children: kids.map(k => k.id) });
        kids.forEach(k => stack.push(k.id));
      }
      return rows;
    }

    const subtree = await collectSubtree(source.id);
    const sourceIds = new Set(subtree.map(s => s.node.id));

    let totalRooms = 0;
    let totalDevices = 0;

    for (const suffix of suffixes) {
      await prisma.$transaction(async (tx) => {
        const idMap = new Map<string, string>();

        for (const entry of subtree) {
          const { node } = entry;
          const newId = uuidv4();
          const newName = prefix ? `${prefix} ${suffix} - ${node.name}` : `${node.name} (${suffix})`;

          await tx.roomNode.create({
            data: {
              id: newId,
              name: newName,
              locationId: node.locationId,
              parentId: null, // temporary; relinked below
              createdById: req.user!.id,
            },
          });
          idMap.set(node.id, newId);
          totalRooms += 1;
        }

        // Relink parents
        for (const entry of subtree) {
          const newNodeId = idMap.get(entry.node.id)!;

          // Get the original's parentId by looking at what nodes reference it
          let origParentId: string | null = null;
          for (const s of subtree) {
            if (s.children.includes(entry.node.id)) {
              origParentId = s.node.id;
              break;
            }
          }
          if (origParentId && sourceIds.has(origParentId)) {
            const mappedParent = idMap.get(origParentId);
            if (mappedParent) {
              await tx.roomNode.update({ where: { id: newNodeId }, data: { parentId: mappedParent } });
            }
          } else if (entry.node.id === source.id) {
            // Root of the subtree keeps the source's parent
            await tx.roomNode.update({ where: { id: newNodeId }, data: { parentId: source.parentId } });
          }
        }

        // Clone direct devices of source rooms and auto-populate area
        for (const entry of subtree) {
          const clonedRoomId = idMap.get(entry.node.id)!;
          const clonedBreadcrumb = await buildBreadcrumbForRoom(clonedRoomId);
          let clonedAreaId: string | null = null;
          if (clonedBreadcrumb) {
            clonedAreaId = await resolveAreaForBreadcrumb(clonedBreadcrumb, tx);
          }

          const sourceDevices = await tx.device.findMany({ where: { roomId: entry.node.id } });
          for (const d of sourceDevices) {
            const newDeviceId = uuidv4();
            const cloneData: Record<string, unknown> = { id: newDeviceId, createdById: req.user!.id };
            for (const field of DEVICE_CLONE_ALLOWLIST) {
              if (field === 'roomId') {
                cloneData.roomId = clonedRoomId;
              } else if (field === 'locationId') {
                cloneData.locationId = entry.node.locationId;
              } else if (field === 'areaId') {
                cloneData.areaId = clonedAreaId;
              } else {
                cloneData[field] = (d as Record<string, unknown>)[field];
              }
            }
            await tx.device.create({ data: cloneData as Parameters<typeof tx.device.create>[0]['data'] });
            totalDevices += 1;
          }
        }
      });
    }

    res.status(201).json({ rooms_created: totalRooms, devices_cloned: totalDevices });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg.includes('Chỉ phòng con')) return res.status(400).json({ error: msg });
    console.error('Duplicate room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

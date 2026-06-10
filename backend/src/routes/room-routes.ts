import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma-client.js';
import { mapDevice } from '../utils/response-mapper.js';
import { generateQrCode } from '../utils/qrcode-generator.js';
import { getEffectiveBaseUrl } from '../lib/settings.js';
import { syncDeviceTransferRecord } from '../utils/transfer-records.js';
import { validateTypeStatus, applyDateStatusRules, type StatusData } from '../utils/device-status-rules.js';
import { requirePermission } from '../middleware/require-permission.js';

const router: ReturnType<typeof Router> = Router();

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ATTACHMENT_MIMES = [...IMAGE_MIMES, 'application/pdf'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'primary_image') {
      if (IMAGE_MIMES.includes(file.mimetype)) cb(null, true);
      else cb(new Error('Primary image must be JPEG, PNG, WebP, or GIF') as unknown as null, false);
    } else if (file.fieldname === 'attachments') {
      if (ATTACHMENT_MIMES.includes(file.mimetype)) cb(null, true);
      else cb(new Error('Attachments must be images or PDF') as unknown as null, false);
    } else {
      cb(null, true);
    }
  },
});
const deviceUpload = upload.fields([
  { name: 'primary_image', maxCount: 1 },
  { name: 'attachments', maxCount: 9 },
]);

type RoomNodeSummary = {
  id: string;
  name: string;
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

// Get allowed location IDs for the current user (used for device-level filtering).
async function getUserLocationIds(req: Request): Promise<string[] | null> {
  if (req.user!.role !== 'USER') return null;
  const assignments = await prisma.userLocation.findMany({
    where: { userId: req.user!.id },
    select: { locationId: true },
  });
  const ids = assignments.map(a => a.locationId);
  return ids.length > 0 ? ids : ['__NO_LOCATIONS__'];
}

// Build breadcrumb by walking up parent chain
async function buildBreadcrumb(node: { id: string; name: string; parentId: string | null }, tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<string> {
  const db = (tx ?? prisma) as typeof prisma;
  const parts: string[] = [node.name];
  let currentId = node.parentId;
  const visited = new Set<string>([node.id]);
  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const parent = await db.roomNode.findUnique({ where: { id: currentId }, select: { id: true, name: true, parentId: true } });
    if (!parent) break;
    parts.unshift(parent.name);
    currentId = parent.parentId;
  }
  return parts.join(BREADCRUMB_DELIMITER);
}

// Build breadcrumb for a room by ID
async function buildBreadcrumbForRoom(roomId: string, tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<string> {
  const db = (tx ?? prisma) as typeof prisma;
  const node = await db.roomNode.findUnique({ where: { id: roomId }, select: { id: true, name: true, parentId: true } });
  if (!node) return '';
  return buildBreadcrumb(node, tx);
}

// Find-or-create an Area whose name matches the parent breadcrumb path (folder tree minus 1).
// For "Block A -> Floor 2 -> 1202", resolves to area "Block A -> Floor 2".
// Returns null for single-level rooms (no parent hierarchy above them).
async function resolveAreaForRoomBreadcrumb(roomBreadcrumb: string, tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<string | null> {
  if (!roomBreadcrumb) return null;
  const parts = roomBreadcrumb.split(BREADCRUMB_DELIMITER);
  if (parts.length <= 1) return null; // single-level room, no parent area
  const areaName = parts.slice(0, -1).join(BREADCRUMB_DELIMITER);

  const db = tx ?? prisma;
  let area = await (db as typeof prisma).area.findFirst({ where: { name: areaName } });
  if (!area) {
    area = await (db as typeof prisma).area.create({ data: { id: uuidv4(), name: areaName } });
  }
  return area.id;
}

// Recursively sync areaId for all devices in a room and its descendants
async function syncRoomDevicesArea(roomId: string, tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<void> {
  const stack = [roomId];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    const breadcrumb = await buildBreadcrumbForRoom(currentId, tx);
    if (breadcrumb) {
      const areaId = await resolveAreaForRoomBreadcrumb(breadcrumb, tx);
      await (tx as typeof prisma).device.updateMany({ where: { roomId: currentId }, data: { areaId } });
    }
    const children = await (tx as typeof prisma).roomNode.findMany({ where: { parentId: currentId }, select: { id: true } });
    for (const child of children) stack.push(child.id);
  }
}

// Build breadcrumb for a room using an in-memory map (avoids N+1 queries)
function getBreadcrumbFromMap(roomId: string, roomMap: Map<string, { id: string; name: string; parentId: string | null }>): string {
  const parts: string[] = [];
  let current = roomMap.get(roomId);
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    parts.unshift(current.name);
    if (!current.parentId) break;
    current = roomMap.get(current.parentId);
  }
  return parts.join(BREADCRUMB_DELIMITER);
}

// Auto-delete room-specific areas (containing ' -> ') that no longer correspond
// to any active room's parent path.
async function cleanupEmptyAreas(tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<void> {
  const db = (tx ?? prisma) as typeof prisma;

  // 1. Fetch all room nodes to reconstruct active hierarchy
  const rooms = await db.roomNode.findMany({
    select: { id: true, name: true, parentId: true },
  });

  const roomMap = new Map<string, { id: string; name: string; parentId: string | null }>();
  for (const r of rooms) {
    roomMap.set(r.id, r);
  }

  // 2. Determine all active area names representing parent paths (folder tree minus 1)
  const activeAreaNames = new Set<string>();
  for (const r of rooms) {
    const breadcrumb = getBreadcrumbFromMap(r.id, roomMap);
    const parts = breadcrumb.split(BREADCRUMB_DELIMITER);
    if (parts.length > 1) {
      const areaName = parts.slice(0, -1).join(BREADCRUMB_DELIMITER);
      activeAreaNames.add(areaName);
    }
  }

  // 3. Find all room-specific areas currently stored in database
  const roomSpecificAreas = await db.area.findMany({
    where: { name: { contains: BREADCRUMB_DELIMITER } },
    select: { id: true, name: true },
  });

  // 4. Filter out any that are no longer associated with active parent paths
  const emptyAreas = roomSpecificAreas.filter(a => !activeAreaNames.has(a.name));

  // 5. Disconnect devices from these areas before deleting, then delete
  if (emptyAreas.length > 0) {
    const emptyAreaIds = emptyAreas.map(a => a.id);
    await db.device.updateMany({
      where: { areaId: { in: emptyAreaIds } },
      data: { areaId: null },
    });
    await db.area.deleteMany({
      where: { id: { in: emptyAreaIds } },
    });
  }
}

// --- Optimized in-memory helpers for read-heavy list/tree endpoints ---

type RoomRow = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: Date;
  _count: { devices: number; children: number };
};

function buildBreadcrumbFromMap(nodeId: string, roomMap: Map<string, RoomRow>): string {
  const node = roomMap.get(nodeId);
  if (!node) return '';
  const parts: string[] = [node.name];
  let currentId = node.parentId;
  const visited = new Set<string>([nodeId]);
  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const parent = roomMap.get(currentId);
    if (!parent) break;
    parts.unshift(parent.name);
    currentId = parent.parentId;
  }
  return parts.join(BREADCRUMB_DELIMITER);
}

function computeDescendantSummaryFromMap(
  roomId: string,
  childrenMap: Map<string, string[]>,
  deviceCountMap: Map<string, number>,
  maintCountMap: Map<string, number>,
): { descendantDeviceCount: number; status: string } {
  const stack = [roomId];
  let descendantDeviceCount = 0;
  let needsMaintenance = false;
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    descendantDeviceCount += deviceCountMap.get(currentId) ?? 0;
    if ((maintCountMap.get(currentId) ?? 0) > 0) needsMaintenance = true;
    const kids = childrenMap.get(currentId);
    if (kids) for (const kid of kids) stack.push(kid);
  }
  return { descendantDeviceCount, status: needsMaintenance ? 'needs_maintenance' : 'in_use' };
}

function mapRoomSummaryFromMap(
  node: RoomRow,
  roomMap: Map<string, RoomRow>,
  childrenMap: Map<string, string[]>,
  deviceCountMap: Map<string, number>,
  maintCountMap: Map<string, number>,
): RoomNodeSummary {
  const { descendantDeviceCount, status } = computeDescendantSummaryFromMap(node.id, childrenMap, deviceCountMap, maintCountMap);
  return {
    id: node.id,
    name: node.name,
    parent_id: node.parentId,
    breadcrumb: buildBreadcrumbFromMap(node.id, roomMap),
    device_count: node._count.devices,
    descendant_device_count: descendantDeviceCount,
    status,
    has_children: node._count.children > 0,
    is_leaf: node._count.children === 0,
    created_at: node.createdAt.toISOString(),
  };
}

async function fetchRoomDataBulk() {
  const [allRooms, maintGroupRaw, deviceGroupRaw] = await Promise.all([
    prisma.roomNode.findMany({
      include: { _count: { select: { devices: true, children: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.device.groupBy({
      by: ['roomId'],
      _count: { _all: true },
      where: { OR: [{ maintenanceStatus: 'needs_maintenance' }, { status: 'under_repair' }] },
    }),
    prisma.device.groupBy({
      by: ['roomId'],
      _count: { _all: true },
    }),
  ]);

  const roomMap = new Map<string, RoomRow>();
  const childrenMap = new Map<string, string[]>();
  const deviceCountMap = new Map<string, number>();
  const maintCountMap = new Map<string, number>();

  for (const room of allRooms) {
    roomMap.set(room.id, room as RoomRow);
    if (room.parentId) {
      const kids = childrenMap.get(room.parentId) ?? [];
      kids.push(room.id);
      childrenMap.set(room.parentId, kids);
    }
  }
  for (const g of deviceGroupRaw) {
    if (g.roomId) deviceCountMap.set(g.roomId, g._count._all);
  }
  for (const g of maintGroupRaw) {
    if (g.roomId) maintCountMap.set(g.roomId, g._count._all);
  }

  return { allRooms: allRooms as RoomRow[], roomMap, childrenMap, deviceCountMap, maintCountMap };
}

// --- Original per-node helpers (kept for single-item GET /:id and write operations) ---

// Compute descendant device count and maintenance/repair-derived status via recursive descent.
// A room is flagged 'needs_maintenance' if ANY device in its subtree has
// maintenanceStatus === 'needs_maintenance' OR status === 'under_repair'.
async function computeDescendantSummary(roomId: string): Promise<{ descendantDeviceCount: number; status: string }> {
  const stack = [roomId];
  let descendantDeviceCount = 0;
  let needsMaintenance = false;

  while (stack.length > 0) {
    const currentId = stack.pop()!;
    const children = await prisma.roomNode.findMany({
      where: { parentId: currentId },
      select: { id: true, devices: { select: { maintenanceStatus: true, status: true } } },
    });
    for (const child of children) {
      stack.push(child.id);
      for (const d of child.devices) {
        descendantDeviceCount += 1;
        if (d.maintenanceStatus === 'needs_maintenance' || d.status === 'under_repair') needsMaintenance = true;
      }
    }
    if (currentId === roomId) {
      const directDevices = await prisma.device.findMany({
        where: { roomId: currentId },
        select: { maintenanceStatus: true, status: true },
      });
      for (const d of directDevices) {
        descendantDeviceCount += 1;
        if (d.maintenanceStatus === 'needs_maintenance' || d.status === 'under_repair') needsMaintenance = true;
      }
    }
  }
  return { descendantDeviceCount, status: needsMaintenance ? 'needs_maintenance' : 'in_use' };
}

async function mapRoomSummary(node: {
  id: string;
  name: string;
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

// GET /api/rooms — flat list for selectors/search (all rooms visible to all permitted users)
// Optimized: 3 parallel queries instead of O(N²) recursive queries
router.get('/', requirePermission('rooms', 'view'), async (req: Request, res: Response) => {
  try {
    const { allRooms, roomMap, childrenMap, deviceCountMap, maintCountMap } = await fetchRoomDataBulk();
    const summaries = allRooms.map(room =>
      mapRoomSummaryFromMap(room, roomMap, childrenMap, deviceCountMap, maintCountMap),
    );
    res.json(summaries);
  } catch (err) {
    console.error('List rooms error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rooms/tree — full nested tree (all rooms visible)
// Optimized: 3 parallel queries, tree built in-memory
router.get('/tree', requirePermission('rooms', 'view'), async (req: Request, res: Response) => {
  try {
    const { allRooms, roomMap, childrenMap, deviceCountMap, maintCountMap } = await fetchRoomDataBulk();

    function buildTree(parentId: string | null): RoomTreeNode[] {
      const nodes = allRooms.filter(r => r.parentId === parentId);
      return nodes.map(node => {
        const summary = mapRoomSummaryFromMap(node, roomMap, childrenMap, deviceCountMap, maintCountMap);
        return { ...summary, children: buildTree(node.id) };
      });
    }

    res.json(buildTree(null));
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
        _count: { select: { devices: true, children: true } },
      },
    });
    if (!node) return res.status(404).json({ error: 'Room not found' });

    res.json(await mapRoomSummary(node));
  } catch (err) {
    console.error('Get room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify parentId has no direct devices (leaf-only invariant)
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

// POST /api/rooms — create node (rooms are location-agnostic)
router.post('/', requirePermission('rooms', 'create'), async (req: Request, res: Response) => {
  try {
    const { name, parent_id } = req.body as { name?: string; parent_id?: string | null };
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (name.trim().length > 255) return res.status(400).json({ error: 'Name too long (max 255 chars)' });

    let resolvedParentId: string | null = null;
    if (parent_id && parent_id.trim()) {
      const parent = await prisma.roomNode.findUnique({ where: { id: parent_id.trim() } });
      if (!parent) return res.status(400).json({ error: 'Parent room not found' });
      resolvedParentId = parent.id;
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
          parentId: resolvedParentId,
          createdById: req.user!.id,
        },
        include: {
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
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Room not found' });

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

      if (nameChanged || parentChanged) {
        await syncRoomDevicesArea(req.params.id as string, tx);
        await cleanupEmptyAreas(tx);
      }
    });

    const node = await prisma.roomNode.findUnique({
      where: { id: req.params.id as string },
      include: {
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

// POST /api/rooms/bulk-delete — delete multiple rooms at once
router.post('/bulk-delete', requirePermission('rooms', 'delete'), async (req: Request, res: Response) => {
  try {
    const { ids } = req.body as { ids?: string[] };
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array is required' });
    if (ids.length > 100) return res.status(400).json({ error: 'Maximum 100 rooms per bulk delete' });

    const deleted: string[] = [];
    const skipped: { id: string; reason: string }[] = [];

    for (const id of ids) {
      const room = await prisma.roomNode.findUnique({
        where: { id },
        include: { _count: { select: { devices: true, children: true } } },
      });
      if (!room) {
        skipped.push({ id, reason: 'Room not found' });
        continue;
      }
      if ((room._count?.children ?? 0) > 0) {
        skipped.push({ id, reason: 'Room still has child rooms' });
        continue;
      }
      if ((room._count?.devices ?? 0) > 0) {
        skipped.push({ id, reason: 'Room still has devices assigned' });
        continue;
      }
      await prisma.roomNode.delete({ where: { id } });
      deleted.push(id);
    }

    // Auto-delete orphaned room-specific areas after bulk deletion
    if (deleted.length > 0) {
      await cleanupEmptyAreas();
    }

    res.json({ deleted: deleted.length, deleted_ids: deleted, skipped });
  } catch (err) {
    console.error('Bulk delete rooms error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/rooms/:id — block if has children or direct devices
router.delete('/:id', requirePermission('rooms', 'delete'), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.roomNode.findUnique({
      where: { id: req.params.id as string },
      include: { _count: { select: { devices: true, children: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Room not found' });

    const childCount = existing._count?.children ?? 0;
    const deviceCount = existing._count?.devices ?? 0;
    if (childCount > 0) return res.status(409).json({ error: 'Cannot delete room: it still has child rooms' });
    if (deviceCount > 0) return res.status(409).json({ error: 'Cannot delete room: it still has devices assigned' });

    await prisma.roomNode.delete({ where: { id: req.params.id as string } });

    // Auto-delete orphaned room-specific areas after deletion
    await cleanupEmptyAreas();

    res.status(204).send();
  } catch (err) {
    console.error('Delete room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rooms/:roomId/devices — list devices in a room
// Device-level RBAC: USER role only sees devices whose locationId matches their assigned locations.
router.get('/:roomId/devices', requirePermission('rooms', 'view'), async (req: Request, res: Response) => {
  try {
    const room = await prisma.roomNode.findUnique({
      where: { id: req.params.roomId as string },
      select: { id: true },
    });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const where: Record<string, unknown> = { roomId: req.params.roomId as string };
    const allowedLocations = await getUserLocationIds(req);
    if (allowedLocations) where.locationId = { in: allowedLocations };

    const devices = await prisma.device.findMany({
      where,
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
// location_id now comes from the request body (each device has its own unit).
router.post('/:roomId/devices', requirePermission('rooms', 'create'), deviceUpload, async (req: Request, res: Response) => {
  try {
    const room = await prisma.roomNode.findUnique({
      where: { id: req.params.roomId as string },
      select: { id: true, _count: { select: { children: true } } },
    });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room._count.children > 0) return res.status(409).json({ error: 'Cannot add device to a room that has child rooms' });

    const { name, store_id, location_id, area_id, managed_by, owned_by, serial_number, model: deviceModel, manufacturer, description, type, status, warranty_period, transfer_to, transfer_date, disposal_date, loss_date } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!store_id?.trim()) return res.status(400).json({ error: 'Store ID is required' });
    if (!location_id?.trim()) return res.status(400).json({ error: 'Location is required' });

    const location = await prisma.location.findUnique({ where: { id: location_id.trim() } });
    if (!location) return res.status(400).json({ error: 'Invalid location selected' });

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
      disposalDate: disposal_date ? new Date(disposal_date) : null,
      lossDate: loss_date ? new Date(loss_date) : null,
    };
    statusData = applyDateStatusRules(deviceType, statusData);

    // Auto-populate area from room breadcrumb (folder tree minus 1)
    const roomBreadcrumb = await buildBreadcrumbForRoom(room.id);
    const roomAreaId = await resolveAreaForRoomBreadcrumb(roomBreadcrumb);

    const id = uuidv4();
    const baseUrl = await getEffectiveBaseUrl();
    const qrcode = await generateQrCode(id, baseUrl);

    const created = await prisma.$transaction(async (tx) => {
      return tx.device.create({
        data: {
          id,
          storeId: store_id.trim(),
          name: name.trim(),
          locationId: location_id.trim(),
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
          ownedBy: owned_by?.trim() || '',
          transferTo: transfer_to?.trim() || null,
          transferDate: transfer_date ? new Date(transfer_date) : null,
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

    async function collectSubtree(rootId: string): Promise<{ node: { id: string; name: string }; children: string[] }[]> {
      const rows: { node: { id: string; name: string }; children: string[] }[] = [];
      const stack = [rootId];
      while (stack.length > 0) {
        const currentId = stack.pop()!;
        const node = await prisma.roomNode.findUnique({
          where: { id: currentId },
          select: { id: true, name: true, parentId: true },
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
    const baseUrl = await getEffectiveBaseUrl();

    let totalRooms = 0;
    let totalDevices = 0;

    for (const suffix of suffixes) {
      await prisma.$transaction(async (tx) => {
        const idMap = new Map<string, string>();

        for (const entry of subtree) {
          const newId = uuidv4();
          // Format: "[prefix]suffix" — prefix attaches directly without space
          const newName = prefix ? `${prefix}${suffix}` : suffix;

          await tx.roomNode.create({
            data: {
              id: newId,
              name: newName,
              parentId: null, // temporary; relinked below
              createdById: req.user!.id,
            },
          });
          idMap.set(entry.node.id, newId);
          totalRooms += 1;
        }

        // Relink parents
        for (const entry of subtree) {
          const newNodeId = idMap.get(entry.node.id)!;

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
          const clonedBreadcrumb = await buildBreadcrumbForRoom(clonedRoomId, tx);
          const clonedAreaId = await resolveAreaForRoomBreadcrumb(clonedBreadcrumb, tx);

          const sourceDevices = await tx.device.findMany({ where: { roomId: entry.node.id } });
          for (const d of sourceDevices) {
            const newDeviceId = uuidv4();
            const qrcode = await generateQrCode(newDeviceId, baseUrl);
            const cloneData: Record<string, unknown> = { id: newDeviceId, createdById: req.user!.id, qrcode: new Uint8Array(qrcode) };
            for (const field of DEVICE_CLONE_ALLOWLIST) {
              if (field === 'roomId') {
                cloneData.roomId = clonedRoomId;
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

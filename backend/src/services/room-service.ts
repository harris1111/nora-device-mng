import prisma from '../lib/prisma-client.js';

// Validate: target parent cannot be self or descendant (circular reference prevention)
async function validateNoCircularRef(nodeId: string, newParentId: string): Promise<void> {
  const parent = await prisma.roomNode.findUnique({
    where: { id: newParentId },
    select: { path: true },
  });
  if (!parent) throw new NotFoundError('Parent not found');
  if (parent.path.includes(nodeId)) {
    throw new BadRequestError('Cannot move a node into its own descendant');
  }
}

// Compute path for a new node under a parent
async function computePath(parentId: string | null, nodeId: string): Promise<string> {
  if (!parentId) return nodeId;
  const parent = await prisma.roomNode.findUnique({
    where: { id: parentId },
    select: { path: true },
  });
  return parent ? `${parent.path}.${nodeId}` : nodeId;
}

// Delete guard: block if node has children or devices
async function guardDelete(nodeId: string): Promise<void> {
  const [childCount, deviceCount] = await Promise.all([
    prisma.roomNode.count({ where: { parentId: nodeId } }),
    prisma.device.count({ where: { roomId: nodeId } }),
  ]);
  if (childCount > 0) {
    throw new ConflictError(`Cannot delete: node has ${childCount} child(ren). Remove them first.`);
  }
  if (deviceCount > 0) {
    throw new ConflictError(`Cannot delete: room has ${deviceCount} device(s). Reassign them first.`);
  }
}

// Status aggregation: compute room status from subtree device maintenanceStatus
export async function aggregateRoomStatus(roomId: string): Promise<string> {
  const node = await prisma.roomNode.findUnique({
    where: { id: roomId },
    select: { path: true },
  });
  if (!node) return 'in_use';

  const devices = await prisma.device.findMany({
    where: {
      room: { path: { startsWith: node.path } },
    },
    select: { maintenanceStatus: true },
  });

  const statuses = devices.map(d => d.maintenanceStatus);
  if (statuses.some(s => s === 'needs_maintenance')) return 'maintenance';
  return 'in_use';
}

// Bubble up: recompute status for all ancestors
export async function recomputeAncestors(roomId: string): Promise<void> {
  let current = await prisma.roomNode.findUnique({
    where: { id: roomId },
    select: { id: true, parentId: true },
  });
  while (current?.parentId) {
    const newStatus = await aggregateRoomStatus(current.parentId);
    await prisma.roomNode.update({
      where: { id: current.parentId },
      data: { status: newStatus },
    });
    current = await prisma.roomNode.findUnique({
      where: { id: current.parentId },
      select: { id: true, parentId: true },
    });
  }
}

class NotFoundError extends Error { constructor(m: string) { super(m); this.name = 'NotFoundError'; } }
class BadRequestError extends Error { constructor(m: string) { super(m); this.name = 'BadRequestError'; } }
class ConflictError extends Error { constructor(m: string) { super(m); this.name = 'ConflictError'; } }

export async function getTree() {
  const nodes = await prisma.roomNode.findMany({
    include: { _count: { select: { devices: true } } },
    orderBy: { name: 'asc' },
  });
  const { buildTree } = await import('../utils/room-mapper.js');
  return buildTree(nodes);
}

export async function listRooms(parentId?: string) {
  const where = parentId ? { parentId } : {};
  return prisma.roomNode.findMany({
    where,
    include: { _count: { select: { devices: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function getRoom(id: string) {
  const node = await prisma.roomNode.findUnique({
    where: { id },
    include: {
      _count: { select: { devices: true } },
      children: {
        include: { _count: { select: { devices: true } } },
        orderBy: { name: 'asc' },
      },
    },
  });
  if (!node) throw new NotFoundError('Room node not found');
  return node;
}

export async function createNode(data: {
  name: string;
  code?: string | null;
  description?: string;
  parentId?: string | null;
  createdById?: string;
}) {
  if (!data.name?.trim()) throw new BadRequestError('Name is required');

  const id = crypto.randomUUID();
  const path = await computePath(data.parentId ?? null, id);

  const node = await prisma.roomNode.create({
    data: {
      id,
      name: data.name.trim(),
      code: data.code?.trim() || null,
      description: data.description?.trim() || '',
      parentId: data.parentId ?? null,
      path,
      createdById: data.createdById ?? null,
    },
    include: { _count: { select: { devices: true } } },
  });

  return node;
}

export async function updateNode(id: string, data: {
  name?: string;
  code?: string | null;
  description?: string;
  updatedById?: string;
}) {
  const existing = await prisma.roomNode.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Room node not found');

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.code !== undefined) updateData.code = data.code?.trim() || null;
  if (data.description !== undefined) updateData.description = data.description.trim();
  if (data.updatedById) updateData.updatedById = data.updatedById;

  return prisma.roomNode.update({
    where: { id },
    data: updateData,
    include: { _count: { select: { devices: true } } },
  });
}

export async function moveNode(id: string, newParentId: string | null) {
  const existing = await prisma.roomNode.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Room node not found');

  if (newParentId === id) throw new BadRequestError('Cannot move a node into itself');

  if (newParentId) {
    await validateNoCircularRef(id, newParentId);
  }

  // Recompute path for this node and all descendants
  const newPath = await computePath(newParentId, id);

  await prisma.$transaction(async (tx) => {
    // Update this node's parent and path
    await tx.roomNode.update({
      where: { id },
      data: { parentId: newParentId, path: newPath },
    });

    // Update all descendants' paths
    const descendants = await tx.roomNode.findMany({
      where: { path: { startsWith: existing.path + '.' } },
      select: { id: true, path: true },
      orderBy: { path: 'asc' },
    });

    for (const desc of descendants) {
      const updatedPath = newPath + desc.path.slice(existing.path.length);
      await tx.roomNode.update({
        where: { id: desc.id },
        data: { path: updatedPath },
      });
    }
  });

  // Recompute status for old parent chain and new parent chain
  if (existing.parentId) await recomputeAncestors(existing.parentId);
  if (newParentId) await recomputeAncestors(newParentId);

  return prisma.roomNode.findUnique({
    where: { id },
    include: { _count: { select: { devices: true } } },
  });
}

export async function deleteNode(id: string) {
  const existing = await prisma.roomNode.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Room node not found');

  await guardDelete(id);

  const parentId = existing.parentId;
  await prisma.roomNode.delete({ where: { id } });

  // Recompute status for ancestors
  if (parentId) await recomputeAncestors(parentId);
}

export async function assignDeviceToRoom(roomId: string, deviceId: string) {
  const room = await prisma.roomNode.findUnique({
    where: { id: roomId },
    select: { id: true, children: { select: { id: true }, take: 1 } },
  });
  if (!room) throw new NotFoundError('Room not found');

  // Must be leaf (no children)
  if (room.children.length > 0) throw new BadRequestError('Can only assign devices to leaf rooms (no sub-rooms)');

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) throw new NotFoundError('Device not found');

  await prisma.device.update({
    where: { id: deviceId },
    data: { roomId, isRoomDevice: true },
  });

  // Recompute room + ancestor statuses
  const newStatus = await aggregateRoomStatus(roomId);
  await prisma.roomNode.update({ where: { id: roomId }, data: { status: newStatus } });
  await recomputeAncestors(roomId);
}

export async function unassignDeviceFromRoom(deviceId: string) {
  const device = await prisma.device.findUnique({ where: { id: deviceId }, select: { id: true, roomId: true } });
  if (!device) throw new NotFoundError('Device not found');

  const oldRoomId = device.roomId;

  await prisma.device.update({
    where: { id: deviceId },
    data: { roomId: null, isRoomDevice: false },
  });

  if (oldRoomId) {
    const newStatus = await aggregateRoomStatus(oldRoomId);
    await prisma.roomNode.update({ where: { id: oldRoomId }, data: { status: newStatus } });
    await recomputeAncestors(oldRoomId);
  }
}

// Rate limiting for duplicate operations
const duplicateCooldown = new Map<string, number[]>();

function checkDuplicateRateLimit(userId: string): void {
  const now = Date.now();
  const window = 60_000; // 60 seconds
  const maxOps = 3;
  const timestamps = duplicateCooldown.get(userId) ?? [];
  const recent = timestamps.filter(t => now - t < window);
  if (recent.length >= maxOps) {
    throw new BadRequestError('Rate limit: max 3 duplicate operations per 60 seconds');
  }
  recent.push(now);
  duplicateCooldown.set(userId, recent);
}

export async function duplicateRoomRange(sourceId: string, opts: {
  rangeStart: number;
  rangeEnd: number;
  namePrefix?: string;
  nameSuffix?: string;
  cloneDevices: boolean;
  userId?: string;
}) {
  const count = opts.rangeEnd - opts.rangeStart + 1;
  if (count < 1) throw new BadRequestError('rangeEnd must be >= rangeStart');
  if (count > 100) throw new BadRequestError('Max 100 rooms per duplicate operation');

  const source = await prisma.roomNode.findUnique({
    where: { id: sourceId },
  });
  if (!source) throw new NotFoundError('Source room not found');

  // Must be leaf
  const hasChildren = await prisma.roomNode.count({ where: { parentId: sourceId } });
  if (hasChildren > 0) throw new BadRequestError('Can only duplicate leaf rooms (no children)');

  // Fetch source devices if cloning
  let sourceDevices: any[] = [];
  if (opts.cloneDevices) {
    sourceDevices = await prisma.device.findMany({
      where: { roomId: sourceId },
    });
  }

  // Pre-check storeId conflicts if cloning devices
  if (sourceDevices.length > 0) {
    const suffixes = Array.from({ length: count }, (_, i) => `-${opts.rangeStart + i}`);
    const potentialConflicts = sourceDevices.flatMap(d => suffixes.map(s => `${d.storeId}${s}`));
    const existing = await prisma.device.findMany({
      where: { storeId: { in: potentialConflicts } },
      select: { storeId: true },
    });
    if (existing.length > 0) {
      throw new BadRequestError(`StoreId conflict: ${existing.map(e => e.storeId).join(', ')} already exist`);
    }
  }

  // Rate limit
  if (opts.userId) checkDuplicateRateLimit(opts.userId);

  const results = await prisma.$transaction(async (tx) => {
    const { default: crypto } = await import('node:crypto');
    const created: Array<{ id: string }> = [];
    let devicesCloned = 0;

    const parentPath = source.parentId
      ? (await tx.roomNode.findUnique({ where: { id: source.parentId }, select: { path: true } }))?.path ?? null
      : null;

    for (let i = opts.rangeStart; i <= opts.rangeEnd; i++) {
      const newId = crypto.randomUUID();
      const path = parentPath ? `${parentPath}.${newId}` : newId;
      const code = opts.namePrefix ? `${opts.namePrefix.trim()} ${i}`.trim() : null;

      await tx.roomNode.create({
        data: {
          id: newId,
          name: `${source.name} ${i}`,
          code,
          description: source.description,
          parentId: source.parentId,
          path,
          createdById: opts.userId ?? null,
        },
      });
      created.push({ id: newId });

      // Clone devices (metadata only, no attachments)
      if (opts.cloneDevices && sourceDevices.length > 0) {
        for (const device of sourceDevices) {
          await tx.device.create({
            data: {
              storeId: `${device.storeId}-${i}`,
              name: device.name,
              type: device.type,
              model: device.model,
              manufacturer: device.manufacturer,
              serialNumber: '',
              description: device.description,
              status: 'active',
              locationId: device.locationId,
              areaId: device.areaId,
              roomId: newId,
              isRoomDevice: true,
              managedBy: device.managedBy,
              ownedBy: device.ownedBy,
              warrantyPeriod: device.warrantyPeriod,
              createdById: opts.userId ?? null,
            },
          });
          devicesCloned++;
        }
      }
    }
    return { rooms: created, devicesCloned };
  });

  return results;
}

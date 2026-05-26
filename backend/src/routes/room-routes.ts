import { Router, type Request, type Response } from 'express';
import { requirePermission } from '../middleware/require-permission.js';
import * as roomService from '../services/room-service.js';
import { mapRoomNode } from '../utils/room-mapper.js';
import prisma from '../lib/prisma-client.js';

const router: ReturnType<typeof Router> = Router();

// GET /api/rooms/tree — full hierarchy
router.get('/tree', requirePermission('rooms', 'view'), async (_req: Request, res: Response) => {
  try {
    const tree = await roomService.getTree();
    res.json(tree);
  } catch (err) {
    console.error('Get room tree error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rooms — flat list with optional ?parentId= filter
router.get('/', requirePermission('rooms', 'view'), async (req: Request, res: Response) => {
  try {
    const parentId = req.query.parentId as string | undefined;
    const nodes = await roomService.listRooms(parentId || undefined);
    const { mapFlatRoomNode } = await import('../utils/room-mapper.js');
    res.json(nodes.map(mapFlatRoomNode));
  } catch (err) {
    console.error('List rooms error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rooms/:id — single node with children + device count
router.get('/:id', requirePermission('rooms', 'view'), async (req: Request, res: Response) => {
  try {
    const node = await roomService.getRoom(req.params.id as string);
    const childNodes = (node as any).children ?? [];
    const children = childNodes.map((c: any) => mapRoomNode(c));
    res.json(mapRoomNode(node, children));
  } catch (err: any) {
    if (err?.name === 'NotFoundError') return res.status(404).json({ error: err.message });
    console.error('Get room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/rooms — create node
router.post('/', requirePermission('rooms', 'create'), async (req: Request, res: Response) => {
  try {
    const { name, code, description, parent_id } = req.body;
    const node = await roomService.createNode({
      name,
      code,
      description,
      parentId: parent_id || null,
      createdById: req.user!.id,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorUserId: req.user!.id,
        action: 'room.create',
        targetType: 'room',
        targetId: node.id,
        metadata: { roomName: node.name, parentId: node.parentId },
        ip: req.ip ?? null,
      },
    });

    res.status(201).json(mapRoomNode(node));
  } catch (err: any) {
    if (err?.name === 'BadRequestError') return res.status(400).json({ error: err.message });
    console.error('Create room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/rooms/:id — update node
router.put('/:id', requirePermission('rooms', 'update'), async (req: Request, res: Response) => {
  try {
    const { name, code, description } = req.body;
    const node = await roomService.updateNode(req.params.id as string, {
      name,
      code,
      description,
      updatedById: req.user!.id,
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: req.user!.id,
        action: 'room.update',
        targetType: 'room',
        targetId: node.id,
        metadata: { roomName: node.name },
        ip: req.ip ?? null,
      },
    });

    res.json(mapRoomNode(node));
  } catch (err: any) {
    if (err?.name === 'NotFoundError') return res.status(404).json({ error: err.message });
    console.error('Update room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/rooms/:id/move — reparent node
router.put('/:id/move', requirePermission('rooms', 'update'), async (req: Request, res: Response) => {
  try {
    const { parent_id } = req.body;
    const node = await roomService.moveNode(req.params.id as string, parent_id || null);

    await prisma.auditLog.create({
      data: {
        actorUserId: req.user!.id,
        action: 'room.move',
        targetType: 'room',
        targetId: node!.id,
        metadata: { roomName: node!.name, newParentId: parent_id || null },
        ip: req.ip ?? null,
      },
    });

    res.json(mapRoomNode(node!));
  } catch (err: any) {
    if (err?.name === 'NotFoundError') return res.status(404).json({ error: err.message });
    if (err?.name === 'BadRequestError') return res.status(400).json({ error: err.message });
    console.error('Move room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/rooms/:id — delete node
router.delete('/:id', requirePermission('rooms', 'delete'), async (req: Request, res: Response) => {
  try {
    await roomService.deleteNode(req.params.id as string);

    await prisma.auditLog.create({
      data: {
        actorUserId: req.user!.id,
        action: 'room.delete',
        targetType: 'room',
        targetId: req.params.id as string,
        metadata: {},
        ip: req.ip ?? null,
      },
    });

    res.status(204).send();
  } catch (err: any) {
    if (err?.name === 'NotFoundError') return res.status(404).json({ error: err.message });
    if (err?.name === 'ConflictError') return res.status(409).json({ error: err.message });
    console.error('Delete room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/rooms/unassign-device — unassign device from room (MUST come before /:id/assign-device)
router.put('/unassign-device', requirePermission('rooms', 'update'), async (req: Request, res: Response) => {
  try {
    const { device_id } = req.body;
    if (!device_id) return res.status(400).json({ error: 'device_id is required' });

    await roomService.unassignDeviceFromRoom(device_id);
    res.json({ success: true, message: 'Device unassigned from room' });
  } catch (err: any) {
    if (err?.name === 'NotFoundError') return res.status(404).json({ error: err.message });
    console.error('Unassign device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/rooms/:id/assign-device — assign device to room
router.put('/:id/assign-device', requirePermission('rooms', 'update'), async (req: Request, res: Response) => {
  try {
    const { device_id } = req.body;
    if (!device_id) return res.status(400).json({ error: 'device_id is required' });

    await roomService.assignDeviceToRoom(req.params.id as string, device_id);
    res.json({ success: true, message: 'Device assigned to room' });
  } catch (err: any) {
    if (err?.name === 'NotFoundError') return res.status(404).json({ error: err.message });
    if (err?.name === 'BadRequestError') return res.status(400).json({ error: err.message });
    console.error('Assign device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/rooms/:id/duplicate — duplicate room range
router.post('/:id/duplicate', requirePermission('rooms', 'create'), async (req: Request, res: Response) => {
  try {
    const { range_start, range_end, name_prefix, name_suffix, clone_devices } = req.body;

    if (typeof range_start !== 'number' || typeof range_end !== 'number') {
      return res.status(400).json({ error: 'range_start and range_end are required (number)' });
    }

    const result = await roomService.duplicateRoomRange(req.params.id as string, {
      rangeStart: range_start,
      rangeEnd: range_end,
      namePrefix: name_prefix,
      nameSuffix: name_suffix,
      cloneDevices: !!clone_devices,
      userId: req.user!.id,
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: req.user!.id,
        action: 'room.duplicate',
        targetType: 'room',
        targetId: req.params.id as string,
        metadata: { roomsCreated: result.rooms.length, devicesCloned: result.devicesCloned },
        ip: req.ip ?? null,
      },
    });

    res.status(201).json(result);
  } catch (err: any) {
    if (err?.name === 'NotFoundError') return res.status(404).json({ error: err.message });
    if (err?.name === 'BadRequestError') return res.status(400).json({ error: err.message });
    console.error('Duplicate room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

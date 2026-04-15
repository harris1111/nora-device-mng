import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma-client.js';
import { mapLocation } from '../utils/response-mapper.js';
import { requirePermission } from '../middleware/require-permission.js';

const router: ReturnType<typeof Router> = Router();

// GET /api/locations — list all locations
router.get('/', requirePermission('locations', 'view'), async (_req: Request, res: Response) => {
  try {
    const locations = await prisma.location.findMany({ orderBy: { name: 'asc' } });
    res.json(locations.map(mapLocation));
  } catch (err) {
    console.error('List locations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/locations/:id — get single location
router.get('/:id', requirePermission('locations', 'view'), async (req: Request, res: Response) => {
  try {
    const location = await prisma.location.findUnique({ where: { id: req.params.id as string } });
    if (!location) return res.status(404).json({ error: 'Location not found' });
    res.json(mapLocation(location));
  } catch (err) {
    console.error('Get location error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/locations — create location
router.post('/', requirePermission('locations', 'create'), async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (name.trim().length > 255) return res.status(400).json({ error: 'Name too long (max 255 chars)' });

    const location = await prisma.location.create({
      data: { id: uuidv4(), name: name.trim(), createdById: req.user!.id },
    });
    res.status(201).json(mapLocation(location));
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      return res.status(409).json({ error: 'A location with this name already exists' });
    }
    console.error('Create location error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/locations/:id — update location
router.put('/:id', requirePermission('locations', 'update'), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.location.findUnique({ where: { id: req.params.id as string } });
    if (!existing) return res.status(404).json({ error: 'Location not found' });

    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (name.trim().length > 255) return res.status(400).json({ error: 'Name too long (max 255 chars)' });

    const location = await prisma.location.update({
      where: { id: req.params.id as string },
      data: { name: name.trim(), updatedById: req.user!.id },
    });
    res.json(mapLocation(location));
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      return res.status(409).json({ error: 'A location with this name already exists' });
    }
    console.error('Update location error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/locations/:id — delete location (blocked if devices reference it)
router.delete('/:id', requirePermission('locations', 'delete'), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.location.findUnique({ where: { id: req.params.id as string } });
    if (!existing) return res.status(404).json({ error: 'Location not found' });

    await prisma.location.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2003') {
      return res.status(409).json({ error: 'Cannot delete location: devices are still assigned to it' });
    }
    console.error('Delete location error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

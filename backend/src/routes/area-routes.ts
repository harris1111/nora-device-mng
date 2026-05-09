import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma-client.js';
import { mapArea } from '../utils/response-mapper.js';
import { requirePermission } from '../middleware/require-permission.js';

const router: ReturnType<typeof Router> = Router();

// GET /api/areas — list all areas
router.get('/', requirePermission('areas', 'view'), async (_req: Request, res: Response) => {
  try {
    const areas = await prisma.area.findMany({ orderBy: { name: 'asc' } });
    res.json(areas.map(mapArea));
  } catch (err) {
    console.error('List areas error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/areas/:id — get single area
router.get('/:id', requirePermission('areas', 'view'), async (req: Request, res: Response) => {
  try {
    const area = await prisma.area.findUnique({ where: { id: req.params.id as string } });
    if (!area) return res.status(404).json({ error: 'Area not found' });
    res.json(mapArea(area));
  } catch (err) {
    console.error('Get area error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/areas — create area
router.post('/', requirePermission('areas', 'create'), async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (name.trim().length > 255) return res.status(400).json({ error: 'Name too long (max 255 chars)' });

    const area = await prisma.area.create({
      data: { id: uuidv4(), name: name.trim(), createdById: req.user!.id },
    });
    res.status(201).json(mapArea(area));
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      return res.status(409).json({ error: 'An area with this name already exists' });
    }
    console.error('Create area error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/areas/:id — update area
router.put('/:id', requirePermission('areas', 'update'), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.area.findUnique({ where: { id: req.params.id as string } });
    if (!existing) return res.status(404).json({ error: 'Area not found' });

    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (name.trim().length > 255) return res.status(400).json({ error: 'Name too long (max 255 chars)' });

    const area = await prisma.area.update({
      where: { id: req.params.id as string },
      data: { name: name.trim(), updatedById: req.user!.id },
    });
    res.json(mapArea(area));
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      return res.status(409).json({ error: 'An area with this name already exists' });
    }
    console.error('Update area error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/areas/:id — delete area (blocked if devices reference it)
router.delete('/:id', requirePermission('areas', 'delete'), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.area.findUnique({ where: { id: req.params.id as string } });
    if (!existing) return res.status(404).json({ error: 'Area not found' });

    await prisma.area.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2003') {
      return res.status(409).json({ error: 'Cannot delete area: devices are still assigned to it' });
    }
    console.error('Delete area error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

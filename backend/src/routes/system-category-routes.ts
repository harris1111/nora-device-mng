import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma-client.js';
import { mapSystemCategory } from '../utils/response-mapper.js';
import { requirePermission } from '../middleware/require-permission.js';
import { logAudit } from '../utils/audit-logger.js';

const router: ReturnType<typeof Router> = Router();

export const DEFAULT_SYSTEM_CATEGORIES = [
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

export async function ensureDefaultSystemCategories(): Promise<void> {
  try {
    const count = await prisma.systemCategory.count();
    if (count === 0) {
      for (const name of DEFAULT_SYSTEM_CATEGORIES) {
        await prisma.systemCategory.upsert({
          where: { name },
          update: {},
          create: { name },
        });
      }
    }
  } catch (err) {
    console.error('Failed to ensure default system categories:', err);
  }
}

// GET /api/system-categories — list all system categories
router.get('/', requirePermission('system_categories', 'view'), async (_req: Request, res: Response) => {
  try {
    await ensureDefaultSystemCategories();
    const categories = await prisma.systemCategory.findMany({ orderBy: { name: 'asc' } });
    res.json(categories.map(mapSystemCategory));
  } catch (err) {
    console.error('List system categories error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/system-categories/:id — get single system category
router.get('/:id', requirePermission('system_categories', 'view'), async (req: Request, res: Response) => {
  try {
    const category = await prisma.systemCategory.findUnique({ where: { id: req.params.id as string } });
    if (!category) return res.status(404).json({ error: 'System category not found' });
    res.json(mapSystemCategory(category));
  } catch (err) {
    console.error('Get system category error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/system-categories — create system category
router.post('/', requirePermission('system_categories', 'create'), async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (name.trim().length > 255) return res.status(400).json({ error: 'Name too long (max 255 chars)' });

    const category = await prisma.systemCategory.create({
      data: {
        id: uuidv4(),
        name: name.trim(),
        description: description?.trim() || '',
        createdById: req.user!.id,
      },
    });

    await logAudit({
      actorUserId: req.user!.id,
      action: 'system_category_create',
      targetType: 'SystemCategory',
      targetId: category.id,
      metadata: { name: category.name },
      ip: req.ip || '',
    });

    res.status(201).json(mapSystemCategory(category));
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      return res.status(409).json({ error: 'A system category with this name already exists' });
    }
    console.error('Create system category error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/system-categories/:id — update system category
router.put('/:id', requirePermission('system_categories', 'update'), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.systemCategory.findUnique({ where: { id: req.params.id as string } });
    if (!existing) return res.status(404).json({ error: 'System category not found' });

    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (name.trim().length > 255) return res.status(400).json({ error: 'Name too long (max 255 chars)' });

    const updatedName = name.trim();
    const category = await prisma.systemCategory.update({
      where: { id: req.params.id as string },
      data: {
        name: updatedName,
        description: description !== undefined ? description.trim() : existing.description,
        updatedById: req.user!.id,
      },
    });

    // If category name changed, update referencing devices
    if (existing.name !== updatedName) {
      await prisma.device.updateMany({
        where: { systemCategory: existing.name },
        data: { systemCategory: updatedName },
      });
    }

    await logAudit({
      actorUserId: req.user!.id,
      action: 'system_category_update',
      targetType: 'SystemCategory',
      targetId: category.id,
      metadata: { oldName: existing.name, newName: updatedName },
      ip: req.ip || '',
    });

    res.json(mapSystemCategory(category));
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      return res.status(409).json({ error: 'A system category with this name already exists' });
    }
    console.error('Update system category error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/system-categories/:id — delete system category
router.delete('/:id', requirePermission('system_categories', 'delete'), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.systemCategory.findUnique({ where: { id: req.params.id as string } });
    if (!existing) return res.status(404).json({ error: 'System category not found' });

    // Check if devices are referencing this system category
    const count = await prisma.device.count({ where: { systemCategory: existing.name } });
    if (count > 0) {
      return res.status(409).json({ error: `Cannot delete: ${count} system(s) are assigned to this category` });
    }

    await prisma.systemCategory.delete({ where: { id: req.params.id as string } });

    await logAudit({
      actorUserId: req.user!.id,
      action: 'system_category_delete',
      targetType: 'SystemCategory',
      targetId: existing.id,
      metadata: { name: existing.name },
      ip: req.ip || '',
    });

    res.status(204).send();
  } catch (err: unknown) {
    console.error('Delete system category error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

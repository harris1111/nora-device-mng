import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  getAllLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
} from '../database.js';

const router = Router();

// GET /api/locations — list all locations
router.get('/', (req, res) => {
  res.json(getAllLocations());
});

// GET /api/locations/:id — get single location
router.get('/:id', (req, res) => {
  const location = getLocationById(req.params.id);
  if (!location) return res.status(404).json({ error: 'Location not found' });
  res.json(location);
});

// POST /api/locations — create location
router.post('/', (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (name.trim().length > 255) return res.status(400).json({ error: 'Name too long (max 255 chars)' });

    const id = uuidv4();
    createLocation({ id, name: name.trim() });

    const location = getLocationById(id);
    res.status(201).json(location);
  } catch (err) {
    // Handle UNIQUE constraint violation
    if (err.message?.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'A location with this name already exists' });
    }
    console.error('Create location error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/locations/:id — update location
router.put('/:id', (req, res) => {
  try {
    const existing = getLocationById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Location not found' });

    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (name.trim().length > 255) return res.status(400).json({ error: 'Name too long (max 255 chars)' });

    updateLocation(req.params.id, { name: name.trim() });
    res.json(getLocationById(req.params.id));
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'A location with this name already exists' });
    }
    console.error('Update location error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/locations/:id — delete location (blocked if devices reference it)
router.delete('/:id', (req, res) => {
  try {
    const existing = getLocationById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Location not found' });

    const result = deleteLocation(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Location not found' });
    res.status(204).send();
  } catch (err) {
    if (err.message?.includes('FOREIGN KEY constraint failed')) {
      return res.status(409).json({ error: 'Cannot delete location: devices are still assigned to it' });
    }
    console.error('Delete location error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import { Router } from 'express';
import { getDeviceById } from '../database.js';

const router = Router();

// GET /api/public/device/:id — public device info (name + id only)
router.get('/device/:id', (req, res) => {
  const device = getDeviceById(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  res.json({ id: device.id, name: device.name });
});

export default router;

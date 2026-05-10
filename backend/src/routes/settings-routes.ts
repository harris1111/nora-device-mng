import { Router, type Request, type Response } from 'express';
import prisma from '../lib/prisma-client.js';
import { generateQrCode } from '../utils/qrcode-generator.js';
import { getEffectiveBaseUrl, setBaseUrl } from '../lib/settings.js';

const router: ReturnType<typeof Router> = Router();

// SADMIN-only guard for every route in this router
router.use((req: Request, res: Response, next) => {
  if (req.user!.role !== 'SADMIN') return res.status(403).json({ error: 'SADMIN only' });
  next();
});

// GET /api/admin/settings — return current effective settings
router.get('/settings', async (_req: Request, res: Response) => {
  try {
    const baseUrl = await getEffectiveBaseUrl();
    res.json({ base_url: baseUrl });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/settings/base-url — update the public base URL
router.put('/settings/base-url', async (req: Request, res: Response) => {
  try {
    const { base_url } = req.body as { base_url?: string };
    if (typeof base_url !== 'string' || !base_url.trim()) {
      return res.status(400).json({ error: 'base_url is required' });
    }
    const trimmed = base_url.trim();
    if (trimmed.length > 2048) {
      return res.status(400).json({ error: 'base_url too long (max 2048 chars)' });
    }
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return res.status(400).json({ error: 'base_url must be a valid URL' });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.status(400).json({ error: 'base_url must use http or https' });
    }
    const saved = await setBaseUrl(trimmed);
    res.json({ base_url: saved });
  } catch (err) {
    console.error('Update base_url error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/settings/regenerate-qrcodes — rebuild QR PNG for every device
// using the currently configured base URL. Runs synchronously in batches.
router.post('/settings/regenerate-qrcodes', async (_req: Request, res: Response) => {
  try {
    const baseUrl = await getEffectiveBaseUrl();
    const devices = await prisma.device.findMany({ select: { id: true } });

    const BATCH_SIZE = 20;
    let updated = 0;
    for (let i = 0; i < devices.length; i += BATCH_SIZE) {
      const batch = devices.slice(i, i + BATCH_SIZE);
      const buffers = await Promise.all(batch.map(d => generateQrCode(d.id, baseUrl)));
      await prisma.$transaction(
        batch.map((d, idx) =>
          prisma.device.update({
            where: { id: d.id },
            data: { qrcode: new Uint8Array(buffers[idx]!) },
          }),
        ),
      );
      updated += batch.length;
    }

    res.json({ updated, base_url: baseUrl });
  } catch (err) {
    console.error('Regenerate QR codes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

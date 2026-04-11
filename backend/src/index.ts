import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from './lib/prisma-client.js';
import { validateS3Config } from './utils/s3-config-validator.js';
import deviceRoutes from './routes/device-routes.js';
import locationRoutes from './routes/location-routes.js';
import publicRoutes from './routes/public-routes.js';
import attachmentRoutes from './routes/attachment-routes.js';
import maintenanceRoutes from './routes/maintenance-routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// Validate S3 config on startup
validateS3Config();

// Restrict CORS to app origin
app.use(cors({ origin: process.env.BASE_URL || 'http://localhost:3000' }));
app.use(express.json({ limit: '100kb' }));

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/devices', deviceRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/public', publicRoutes);
app.use('/api', attachmentRoutes);
app.use('/api', maintenanceRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '..', 'frontend-dist');
  app.use(express.static(frontendPath));

  app.get('*', (req: Request, res: Response) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Multer error handler
app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large (max 10MB)' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.message?.includes('File type not allowed') || err.message === 'Only image files allowed') {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// Catch-all error handler
app.use((_err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', _err);
  res.status(500).json({ error: 'Internal server error' });
});

// Connect to DB then start server
async function start(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('Connected to PostgreSQL via Prisma');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

start();

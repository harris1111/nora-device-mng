import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import prisma from './lib/prisma-client.js';
import { validateS3Config } from './utils/s3-config-validator.js';
import requireAuth from './middleware/require-auth.js';
import authRoutes from './routes/auth-routes.js';
import deviceRoutes from './routes/device-routes.js';
import locationRoutes from './routes/location-routes.js';
import publicRoutes from './routes/public-routes.js';
import attachmentRoutes from './routes/attachment-routes.js';
import maintenanceRoutes from './routes/maintenance-routes.js';
import transferRoutes from './routes/transfer-routes.js';
import userRoutes from './routes/user-routes.js';
import permissionRoutes from './routes/permission-routes.js';
import auditLogRoutes from './routes/audit-log-routes.js';
import exportRoutes from './routes/export-routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env for S3 vars (without overriding backend/.env values like DATABASE_URL)
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false });

// Validate JWT_SECRET on startup
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Validate S3 config on startup
validateS3Config();

// CORS with credentials for cookie auth
app.use(cors({
  origin: process.env.BASE_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// Health check (public)
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Unprotected routes
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);

// Protected routes — require authentication
app.use('/api/devices/export', requireAuth, exportRoutes);
app.use('/api/devices', requireAuth, deviceRoutes);
app.use('/api/locations', requireAuth, locationRoutes);
app.use('/api', requireAuth, attachmentRoutes);
app.use('/api', requireAuth, maintenanceRoutes);
app.use('/api', requireAuth, transferRoutes);
app.use('/api/users', requireAuth, userRoutes);
app.use('/api/permissions', requireAuth, permissionRoutes);
app.use('/api/audit-logs', requireAuth, auditLogRoutes);

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

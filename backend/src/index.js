import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './database.js';
import deviceRoutes from './routes/device-routes.js';
import locationRoutes from './routes/location-routes.js';
import publicRoutes from './routes/public-routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize SQLite database
initDatabase();

// Restrict CORS to app origin (C1 fix)
app.use(cors({ origin: process.env.BASE_URL || 'http://localhost:3000' }));
app.use(express.json({ limit: '100kb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/devices', deviceRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/public', publicRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '..', 'frontend-dist');
  app.use(express.static(frontendPath));

  // SPA fallback — exclude /api/* routes (H3 fix)
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Multer error handler
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large (max 5MB)' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.message === 'Only image files allowed') {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// Catch-all error handler (H4 fix)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

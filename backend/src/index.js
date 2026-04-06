import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { initDatabase } from './database.js';
import deviceRoutes from './routes/device-routes.js';
import publicRoutes from './routes/public-routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize SQLite database
initDatabase();

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/devices', deviceRoutes);
app.use('/api/public', publicRoutes);

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

import express from 'express';
import cors from 'cors';
import { initDatabase } from './database.js';

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

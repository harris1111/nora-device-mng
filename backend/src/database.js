import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'devices.db');

let db;

// Initialize database with schema migration
export function initDatabase() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      image BLOB,
      image_mime TEXT,
      qrcode BLOB,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return db;
}

export function getDatabase() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

// List all devices (excludes BLOBs for performance)
export function getAllDevices() {
  return db.prepare(
    'SELECT id, name, image_mime, created_at FROM devices ORDER BY created_at DESC'
  ).all();
}

// Get device metadata by ID (excludes BLOBs)
export function getDeviceById(id) {
  return db.prepare(
    'SELECT id, name, image_mime, created_at FROM devices WHERE id = ?'
  ).get(id);
}

// Get device image BLOB + mime type
export function getDeviceImage(id) {
  return db.prepare(
    'SELECT image, image_mime FROM devices WHERE id = ?'
  ).get(id);
}

// Get device QR code BLOB
export function getDeviceQrcode(id) {
  return db.prepare(
    'SELECT qrcode FROM devices WHERE id = ?'
  ).get(id);
}

// Insert new device with image and QR code BLOBs
export function createDevice({ id, name, image, imageMime, qrcode }) {
  return db.prepare(
    'INSERT INTO devices (id, name, image, image_mime, qrcode) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name, image, imageMime, qrcode);
}

// Update device — conditionally updates image if provided
export function updateDevice(id, { name, image, imageMime }) {
  if (image) {
    return db.prepare(
      'UPDATE devices SET name = ?, image = ?, image_mime = ? WHERE id = ?'
    ).run(name, image, imageMime, id);
  }
  return db.prepare(
    'UPDATE devices SET name = ? WHERE id = ?'
  ).run(name, id);
}

// Delete device by ID
export function deleteDevice(id) {
  return db.prepare('DELETE FROM devices WHERE id = ?').run(id);
}

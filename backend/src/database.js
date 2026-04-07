import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'devices.db');

let db;

// Initialize database with schema migration
export function initDatabase() {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create locations table first (referenced by devices)
  db.exec(`
    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      name TEXT NOT NULL,
      location_id TEXT NOT NULL REFERENCES locations(id),
      image BLOB,
      image_mime TEXT,
      qrcode BLOB,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: add store_id column if missing (existing DBs)
  const columns = db.prepare("PRAGMA table_info(devices)").all();
  if (!columns.find(c => c.name === 'store_id')) {
    db.exec("ALTER TABLE devices ADD COLUMN store_id TEXT NOT NULL DEFAULT ''");
  }

  // Migration: add location_id column if missing (existing DBs)
  if (!columns.find(c => c.name === 'location_id')) {
    db.exec("ALTER TABLE devices ADD COLUMN location_id TEXT REFERENCES locations(id)");
  }

  return db;
}

export function getDatabase() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

// ─── Location CRUD ───────────────────────────────────────────────

export function getAllLocations() {
  return db.prepare(
    'SELECT id, name, created_at FROM locations ORDER BY name ASC'
  ).all();
}

export function getLocationById(id) {
  return db.prepare(
    'SELECT id, name, created_at FROM locations WHERE id = ?'
  ).get(id);
}

export function createLocation({ id, name }) {
  return db.prepare(
    'INSERT INTO locations (id, name) VALUES (?, ?)'
  ).run(id, name);
}

export function updateLocation(id, { name }) {
  return db.prepare(
    'UPDATE locations SET name = ? WHERE id = ?'
  ).run(name, id);
}

export function deleteLocation(id) {
  return db.prepare('DELETE FROM locations WHERE id = ?').run(id);
}

// ─── Device CRUD ─────────────────────────────────────────────────

// List all devices (excludes BLOBs for performance), joins location name
export function getAllDevices() {
  return db.prepare(
    `SELECT d.id, d.store_id, d.name, d.location_id, l.name AS location_name,
            d.image_mime, d.created_at
     FROM devices d
     LEFT JOIN locations l ON d.location_id = l.id
     ORDER BY d.created_at DESC`
  ).all();
}

// Get device metadata by ID (excludes BLOBs), joins location name
export function getDeviceById(id) {
  return db.prepare(
    `SELECT d.id, d.store_id, d.name, d.location_id, l.name AS location_name,
            d.image_mime, d.created_at
     FROM devices d
     LEFT JOIN locations l ON d.location_id = l.id
     WHERE d.id = ?`
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
export function createDevice({ id, storeId, name, locationId, image, imageMime, qrcode }) {
  return db.prepare(
    'INSERT INTO devices (id, store_id, name, location_id, image, image_mime, qrcode) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, storeId, name, locationId, image, imageMime, qrcode);
}

// Update device — conditionally updates image if provided, regenerates QR
export function updateDevice(id, { storeId, name, locationId, image, imageMime, qrcode }) {
  if (image) {
    return db.prepare(
      'UPDATE devices SET store_id = ?, name = ?, location_id = ?, image = ?, image_mime = ?, qrcode = ? WHERE id = ?'
    ).run(storeId, name, locationId, image, imageMime, qrcode, id);
  }
  return db.prepare(
    'UPDATE devices SET store_id = ?, name = ?, location_id = ?, qrcode = ? WHERE id = ?'
  ).run(storeId, name, locationId, qrcode, id);
}

// Delete device by ID
export function deleteDevice(id) {
  return db.prepare('DELETE FROM devices WHERE id = ?').run(id);
}

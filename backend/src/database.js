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
      location_id TEXT REFERENCES locations(id),
      managed_by TEXT NOT NULL DEFAULT '',
      owned_by TEXT NOT NULL DEFAULT '',
      serial_number TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      manufacturer TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      image BLOB,
      image_mime TEXT,
      qrcode BLOB,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrations for existing DBs
  const columns = db.prepare("PRAGMA table_info(devices)").all();
  const addCol = (name, def) => {
    if (!columns.find(c => c.name === name)) {
      db.exec(`ALTER TABLE devices ADD COLUMN ${name} ${def}`);
    }
  };
  addCol('store_id', "TEXT NOT NULL DEFAULT ''");
  addCol('location_id', 'TEXT REFERENCES locations(id)');
  addCol('managed_by', "TEXT NOT NULL DEFAULT ''");
  addCol('owned_by', "TEXT NOT NULL DEFAULT ''");
  addCol('serial_number', "TEXT NOT NULL DEFAULT ''");
  addCol('model', "TEXT NOT NULL DEFAULT ''");
  addCol('manufacturer', "TEXT NOT NULL DEFAULT ''");
  addCol('description', "TEXT NOT NULL DEFAULT ''");

  // Transfer history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS device_transfers (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      from_owner TEXT NOT NULL DEFAULT '',
      to_owner TEXT NOT NULL,
      transferred_by TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      transferred_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

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
            d.managed_by, d.owned_by, d.serial_number, d.model, d.manufacturer,
            d.description, d.image_mime, d.created_at
     FROM devices d
     LEFT JOIN locations l ON d.location_id = l.id
     ORDER BY d.created_at DESC`
  ).all();
}

// Get device metadata by ID (excludes BLOBs), joins location name
export function getDeviceById(id) {
  return db.prepare(
    `SELECT d.id, d.store_id, d.name, d.location_id, l.name AS location_name,
            d.managed_by, d.owned_by, d.serial_number, d.model, d.manufacturer,
            d.description, d.image_mime, d.created_at
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
export function createDevice({ id, storeId, name, locationId, managedBy, ownedBy, serialNumber, model, manufacturer, description, image, imageMime, qrcode }) {
  return db.prepare(
    `INSERT INTO devices (id, store_id, name, location_id, managed_by, owned_by, serial_number, model, manufacturer, description, image, image_mime, qrcode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, storeId, name, locationId, managedBy || '', ownedBy || '', serialNumber || '', model || '', manufacturer || '', description || '', image, imageMime, qrcode);
}

// Update device — conditionally updates image if provided, regenerates QR
export function updateDevice(id, { storeId, name, locationId, managedBy, ownedBy, serialNumber, model, manufacturer, description, image, imageMime, qrcode }) {
  if (image) {
    return db.prepare(
      `UPDATE devices SET store_id = ?, name = ?, location_id = ?, managed_by = ?, owned_by = ?,
       serial_number = ?, model = ?, manufacturer = ?, description = ?,
       image = ?, image_mime = ?, qrcode = ? WHERE id = ?`
    ).run(storeId, name, locationId, managedBy || '', ownedBy || '', serialNumber || '', model || '', manufacturer || '', description || '', image, imageMime, qrcode, id);
  }
  return db.prepare(
    `UPDATE devices SET store_id = ?, name = ?, location_id = ?, managed_by = ?, owned_by = ?,
     serial_number = ?, model = ?, manufacturer = ?, description = ?, qrcode = ? WHERE id = ?`
  ).run(storeId, name, locationId, managedBy || '', ownedBy || '', serialNumber || '', model || '', manufacturer || '', description || '', qrcode, id);
}

// Delete device by ID
export function deleteDevice(id) {
  return db.prepare('DELETE FROM devices WHERE id = ?').run(id);
}

// ─── Transfer CRUD ───────────────────────────────────────────────

export function createTransfer({ id, deviceId, fromOwner, toOwner, transferredBy, note }) {
  const txn = db.transaction(() => {
    db.prepare(
      `INSERT INTO device_transfers (id, device_id, from_owner, to_owner, transferred_by, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, deviceId, fromOwner || '', toOwner, transferredBy || '', note || '');
    db.prepare('UPDATE devices SET owned_by = ? WHERE id = ?').run(toOwner, deviceId);
  });
  txn();
}

export function getTransfersByDeviceId(deviceId) {
  return db.prepare(
    `SELECT id, device_id, from_owner, to_owner, transferred_by, note, transferred_at
     FROM device_transfers WHERE device_id = ? ORDER BY transferred_at DESC`
  ).all(deviceId);
}

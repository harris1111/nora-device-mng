# Phase 2: Backend — Database & Models

## Context Links
- [Plan Overview](plan.md)
- [Phase 1: Project Setup](phase-01-project-setup.md)

## Overview
- **Priority**: P1
- **Status**: Pending
- **Effort**: 2h
- **Blocked by**: Phase 1
- **Description**: Set up SQLite database with better-sqlite3, create devices table, implement CRUD helper functions

## Key Insights
- better-sqlite3 is synchronous — no async/await needed for DB calls
- Store images and QR codes as BLOBs directly in SQLite; efficient for images under 5MB
- UUID v4 for device IDs prevents enumeration attacks on public URLs
- `datetime('now')` in SQLite returns UTC — consistent across environments

## Requirements

### Functional
- Devices table created on first run (auto-migration)
- CRUD operations: create, getAll, getById, update, delete
- Image and QR code stored/retrieved as Buffers

### Non-functional
- Database file stored in `backend/data/devices.db`
- WAL mode enabled for better read performance
- Graceful error handling on constraint violations

## Architecture

### Database Schema
```sql
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image BLOB,
  image_mime TEXT,
  qrcode BLOB,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Data Flow
```
Route Handler → database.js helper → better-sqlite3 → devices.db
                    ↓
              Returns plain JS object (id, name, created_at)
              Binary fields (image, qrcode) excluded from list queries
```

## Related Code Files

### Files to Create
```
backend/src/database.js
```

### Files to Modify
```
backend/src/index.js  (import and initialize DB)
```

## Implementation Steps

### 1. Create Database Module

`backend/src/database.js`:
```javascript
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'devices.db');

let db;

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
```

### 2. Implement CRUD Helpers

Add to `backend/src/database.js`:

```javascript
export function getAllDevices() {
  // Exclude BLOBs from list query for performance
  return db.prepare(
    'SELECT id, name, image_mime, created_at FROM devices ORDER BY created_at DESC'
  ).all();
}

export function getDeviceById(id) {
  return db.prepare(
    'SELECT id, name, image_mime, created_at FROM devices WHERE id = ?'
  ).get(id);
}

export function getDeviceImage(id) {
  return db.prepare(
    'SELECT image, image_mime FROM devices WHERE id = ?'
  ).get(id);
}

export function getDeviceQrcode(id) {
  return db.prepare(
    'SELECT qrcode FROM devices WHERE id = ?'
  ).get(id);
}

export function createDevice({ id, name, image, imageMime, qrcode }) {
  return db.prepare(
    'INSERT INTO devices (id, name, image, image_mime, qrcode) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name, image, imageMime, qrcode);
}

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

export function deleteDevice(id) {
  return db.prepare('DELETE FROM devices WHERE id = ?').run(id);
}
```

### 3. Initialize DB in Server Entry

Update `backend/src/index.js` to call `initDatabase()` before starting the server.

### 4. Verify

- Server starts without errors, `devices.db` created in `backend/data/`
- WAL mode active (check with `.pragma('journal_mode')`)

## Todo List

- [ ] Create `backend/src/database.js` with schema migration
- [ ] Implement `getAllDevices()` — excludes BLOBs
- [ ] Implement `getDeviceById()` — metadata only
- [ ] Implement `getDeviceImage()` — returns image BLOB + mime
- [ ] Implement `getDeviceQrcode()` — returns QR BLOB
- [ ] Implement `createDevice()` — inserts with image + QR BLOBs
- [ ] Implement `updateDevice()` — conditional image update
- [ ] Implement `deleteDevice()`
- [ ] Integrate DB init into `index.js`
- [ ] Verify DB file created and WAL mode enabled

## Success Criteria
- Database auto-creates on first run
- All CRUD functions work with test data
- BLOBs excluded from list queries (performance)
- DB file persists in `backend/data/`

## Risk Assessment
- **DB file permissions in Docker**: Mount `backend/data/` as a volume with correct permissions
- **BLOB size**: Multer limit of 5MB (enforced in Phase 3) prevents oversized entries

## Security Considerations
- Parameterized queries only (no string interpolation) — prevents SQL injection
- UUID v4 IDs non-guessable

## Next Steps
→ Phase 3: API routes with image upload and QR generation

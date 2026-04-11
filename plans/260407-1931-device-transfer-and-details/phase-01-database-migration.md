# Phase 1: Database Migration & Models

## Context
- [database.js](../../backend/src/database.js) — existing DB init with migration pattern

## Overview
- **Priority:** P1 (blocks all other phases)
- **Status:** Pending
- **Effort:** 1h

## Key Insights
- Existing migration pattern: check `PRAGMA table_info`, then `ALTER TABLE ADD COLUMN` if missing
- SQLite doesn't support `ADD COLUMN IF NOT EXISTS`, so the PRAGMA check pattern is required
- `device_transfers` is a new table — use `CREATE TABLE IF NOT EXISTS`

## Requirements

### Schema Changes to `devices` table
```sql
ALTER TABLE devices ADD COLUMN managed_by TEXT NOT NULL DEFAULT '';
ALTER TABLE devices ADD COLUMN owned_by TEXT NOT NULL DEFAULT '';
ALTER TABLE devices ADD COLUMN serial_number TEXT DEFAULT '';
ALTER TABLE devices ADD COLUMN model TEXT DEFAULT '';
ALTER TABLE devices ADD COLUMN manufacturer TEXT DEFAULT '';
ALTER TABLE devices ADD COLUMN description TEXT DEFAULT '';
```

### New `device_transfers` table
```sql
CREATE TABLE IF NOT EXISTS device_transfers (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  from_owner TEXT NOT NULL,
  to_owner TEXT NOT NULL,
  transferred_by TEXT NOT NULL DEFAULT '',
  note TEXT DEFAULT '',
  transferred_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Related Code Files
- **Modify:** `backend/src/database.js`

## Implementation Steps

### 1. Add migration for new device columns
In `initDatabase()`, after the existing `location_id` migration block:
```js
// Migration: add ownership & detail columns if missing
const cols = db.prepare("PRAGMA table_info(devices)").all();
const colNames = cols.map(c => c.name);

const newDeviceCols = [
  { name: 'managed_by', sql: "ALTER TABLE devices ADD COLUMN managed_by TEXT NOT NULL DEFAULT ''" },
  { name: 'owned_by', sql: "ALTER TABLE devices ADD COLUMN owned_by TEXT NOT NULL DEFAULT ''" },
  { name: 'serial_number', sql: "ALTER TABLE devices ADD COLUMN serial_number TEXT DEFAULT ''" },
  { name: 'model', sql: "ALTER TABLE devices ADD COLUMN model TEXT DEFAULT ''" },
  { name: 'manufacturer', sql: "ALTER TABLE devices ADD COLUMN manufacturer TEXT DEFAULT ''" },
  { name: 'description', sql: "ALTER TABLE devices ADD COLUMN description TEXT DEFAULT ''" },
];
for (const col of newDeviceCols) {
  if (!colNames.includes(col.name)) db.exec(col.sql);
}
```

### 2. Create device_transfers table
Add after devices table creation:
```js
db.exec(`
  CREATE TABLE IF NOT EXISTS device_transfers (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    from_owner TEXT NOT NULL,
    to_owner TEXT NOT NULL,
    transferred_by TEXT NOT NULL DEFAULT '',
    note TEXT DEFAULT '',
    transferred_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
```

### 3. Update existing CRUD functions

**`getAllDevices()`** — add `managed_by`, `owned_by` to SELECT

**`getDeviceById()`** — add all 6 new columns to SELECT

**`createDevice()`** — accept and INSERT `managedBy`, `ownedBy`, `serialNumber`, `model`, `manufacturer`, `description`

**`updateDevice()`** — accept and UPDATE all new fields (both with-image and without-image branches)

### 4. Add transfer CRUD functions

```js
// ─── Transfer CRUD ──────────────────────────────────────────────

export function createTransfer({ id, deviceId, fromOwner, toOwner, transferredBy, note }) {
  const insert = db.prepare(
    'INSERT INTO device_transfers (id, device_id, from_owner, to_owner, transferred_by, note) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const updateOwner = db.prepare('UPDATE devices SET owned_by = ? WHERE id = ?');
  
  const transferDevice = db.transaction(() => {
    insert.run(id, deviceId, fromOwner, toOwner, transferredBy, note || '');
    updateOwner.run(toOwner, deviceId);
  });
  
  transferDevice();
}

export function getTransfersByDeviceId(deviceId) {
  return db.prepare(
    'SELECT id, device_id, from_owner, to_owner, transferred_by, note, transferred_at FROM device_transfers WHERE device_id = ? ORDER BY transferred_at DESC'
  ).all(deviceId);
}
```

## Todo List
- [ ] Add new column migrations in initDatabase()
- [ ] Create device_transfers table
- [ ] Update getAllDevices() SELECT to include managed_by, owned_by
- [ ] Update getDeviceById() SELECT to include all 6 new columns
- [ ] Update createDevice() to accept/insert new fields
- [ ] Update updateDevice() to accept/update new fields (both branches)
- [ ] Add createTransfer() with transaction (insert + update owned_by)
- [ ] Add getTransfersByDeviceId()

## Success Criteria
- `initDatabase()` runs idempotently on fresh and existing DBs
- New columns exist with correct defaults
- `device_transfers` table created
- All CRUD functions handle new fields

## Risk Assessment
- SQLite `NOT NULL DEFAULT ''` works for ALTER TABLE — verified pattern
- Transaction in createTransfer ensures atomicity of insert+update

# Phase 1: SQLite → Postgres + Prisma Migration

## Context Links
- Current DB: `backend/src/database.js` (better-sqlite3, 203 lines)
- Docker: `docker-compose.yml`, `Dockerfile`
- Routes: `backend/src/routes/device-routes.js`, `location-routes.js`, `public-routes.js`
- Entry: `backend/src/index.js`

## Overview
- **Priority:** P1 — all other phases depend on this
- **Status:** Pending
- **Effort:** 6h
- **Branch:** `feat/postgres-prisma-migration`

Replace better-sqlite3 with Prisma ORM + PostgreSQL. No API contract changes — frontend remains untouched.

## Key Insights
- Current DB uses TEXT primary keys (UUIDs), TEXT dates via `datetime('now')` — Prisma uses native `@id @default(uuid())` and `@default(now())`
- `image` and `image_mime` BLOB columns stay in this phase (removed in Phase 3)
- `qrcode` BLOB column stays — QR codes are small (~2KB), acceptable in DB
- SQLite `PRAGMA foreign_keys = ON` → Prisma handles FK constraints natively
- All current queries are synchronous (better-sqlite3) → Prisma is async — routes already use `async` handlers

## Requirements

### Functional
- PostgreSQL database running in Docker alongside the app
- Prisma schema matching current 3 tables: `locations`, `devices`, `device_transfers`
- All existing CRUD operations work identically via Prisma
- Seed file with sample data for dev

### Non-Functional
- Database data persisted via Docker volume
- Prisma migrations tracked in git
- App fails fast if `DATABASE_URL` missing

## Architecture

### Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Location {
  id        String   @id @default(uuid())
  name      String   @unique
  createdAt DateTime @default(now()) @map("created_at")
  devices   Device[]

  @@map("locations")
}

model Device {
  id           String   @id @default(uuid())
  storeId      String   @map("store_id")
  name         String
  locationId   String?  @map("location_id")
  location     Location? @relation(fields: [locationId], references: [id])
  managedBy    String   @default("") @map("managed_by")
  ownedBy      String   @default("") @map("owned_by")
  serialNumber String   @default("") @map("serial_number")
  model        String   @default("")
  manufacturer String   @default("")
  description  String   @default("")
  image        Bytes?
  imageMime    String?  @map("image_mime")
  qrcode       Bytes?
  createdAt    DateTime @default(now()) @map("created_at")
  transfers    DeviceTransfer[]

  @@map("devices")
}

model DeviceTransfer {
  id            String   @id @default(uuid())
  deviceId      String   @map("device_id")
  device        Device   @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  fromOwner     String   @default("") @map("from_owner")
  toOwner       String   @map("to_owner")
  transferredBy String   @default("") @map("transferred_by")
  note          String   @default("")
  transferredAt DateTime @default(now()) @map("transferred_at")

  @@map("device_transfers")
}
```

### Data Flow
```
Express routes → import prisma from '../lib/prisma-client.js'
              → prisma.device.findMany() / create() / update() / delete()
              → PostgreSQL (Docker service)
```

## Related Code Files

### Files to Create
- `backend/prisma/schema.prisma` — Prisma schema
- `backend/prisma/seed.js` — seed script with sample locations + devices
- `backend/src/lib/prisma-client.js` — singleton Prisma client export

### Files to Modify
- `backend/package.json` — add `prisma`, `@prisma/client`; remove `better-sqlite3`; add prisma scripts
- `backend/src/index.js` — replace `initDatabase()` with Prisma client connect; add graceful shutdown
- `backend/src/routes/device-routes.js` — replace all `database.js` imports with Prisma queries
- `backend/src/routes/location-routes.js` — replace all `database.js` imports with Prisma queries
- `backend/src/routes/public-routes.js` — replace `getDeviceById` with Prisma query
- `docker-compose.yml` — add `postgres` service, `DATABASE_URL` env, depends_on
- `Dockerfile` — remove `python3 make g++` (no native addon), add `npx prisma generate`

### Files to Delete
- `backend/src/database.js` — fully replaced by Prisma

## Implementation Steps

### 1. Add Prisma + PostgreSQL dependencies
```bash
cd backend
npm install @prisma/client
npm install -D prisma
npx prisma init
```

### 2. Write Prisma schema
Create `backend/prisma/schema.prisma` with the schema above. Use `@@map` to keep snake_case table/column names matching current DB for API compatibility.

### 3. Create Prisma client singleton
```js
// backend/src/lib/prisma-client.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export default prisma;
```

### 4. Update docker-compose.yml
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: nora
      POSTGRES_PASSWORD: nora
      POSTGRES_DB: nora_devices
    volumes:
      - pg-data:/var/lib/postgresql/data
    restart: unless-stopped

  app:
    build: .
    ports:
      - "${PORT:-13000}:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - BASE_URL=${BASE_URL:-http://localhost:13000}
      - DATABASE_URL=postgresql://nora:nora@postgres:5432/nora_devices
    depends_on:
      - postgres
    restart: unless-stopped

volumes:
  pg-data:
```
Remove old `device-data` volume (no more SQLite file).

### 5. Update Dockerfile
- Remove `apk add python3 make g++` and cleanup lines (no native addons)
- Add `npx prisma generate` after `npm ci`
- Copy `prisma/` directory into image
- Remove `RUN mkdir -p data`

### 6. Rewrite route handlers with Prisma

**device-routes.js** — key changes:
- `getAllDevices()` → `prisma.device.findMany({ include: { location: true }, orderBy: { createdAt: 'desc' } })`
- `getDeviceById(id)` → `prisma.device.findUnique({ where: { id }, include: { location: true } })`
- `getDeviceImage(id)` → `prisma.device.findUnique({ where: { id }, select: { image: true, imageMime: true } })`
- `createDevice(...)` → `prisma.device.create({ data: {...} })`
- `updateDevice(...)` → `prisma.device.update({ where: { id }, data: {...} })`
- `deleteDevice(id)` → `prisma.device.delete({ where: { id } })`
- Transfer operations: `prisma.$transaction([...])` for atomic transfer+owner update

**location-routes.js:**
- Direct Prisma CRUD. Unique constraint error: catch Prisma `P2002` error code.
- FK constraint on delete: catch Prisma `P2003` error code.

**public-routes.js:**
- `prisma.device.findUnique({ where: { id }, select: { id, storeId, name, location: { select: { name } } } })`

### 7. Update response field mapping
Prisma returns camelCase by default. Routes must map to snake_case for API compatibility:
```js
// Helper: backend/src/utils/response-mapper.js
export function mapDevice(d) {
  return {
    id: d.id,
    store_id: d.storeId,
    name: d.name,
    location_id: d.locationId,
    location_name: d.location?.name || null,
    managed_by: d.managedBy,
    owned_by: d.ownedBy,
    serial_number: d.serialNumber,
    model: d.model,
    manufacturer: d.manufacturer,
    description: d.description,
    image_mime: d.imageMime,
    created_at: d.createdAt?.toISOString(),
  };
}
```

### 8. Update index.js
- Remove `import { initDatabase } from './database.js'` and `initDatabase()` call
- Add Prisma connect on startup + graceful disconnect on SIGTERM

### 9. Create seed file
```js
// backend/prisma/seed.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
// Insert sample locations and devices
```
Add to `package.json`: `"prisma": { "seed": "node prisma/seed.js" }`

### 10. Generate initial migration
```bash
npx prisma migrate dev --name init
```

## Todo List

- [ ] Install Prisma + @prisma/client, remove better-sqlite3
- [ ] Create `prisma/schema.prisma`
- [ ] Create `src/lib/prisma-client.js`
- [ ] Create `src/utils/response-mapper.js`
- [ ] Rewrite `device-routes.js` with Prisma
- [ ] Rewrite `location-routes.js` with Prisma
- [ ] Rewrite `public-routes.js` with Prisma
- [ ] Update `index.js` (remove initDatabase, add Prisma lifecycle)
- [ ] Delete `database.js`
- [ ] Update `docker-compose.yml` with postgres service
- [ ] Update `Dockerfile` (remove native build deps, add prisma generate)
- [ ] Create `prisma/seed.js`
- [ ] Run `npx prisma migrate dev --name init`
- [ ] Test all API endpoints via curl
- [ ] Docker Compose full build test

## Success Criteria
- `docker compose up --build` starts app + postgres
- All existing API endpoints return identical JSON shape
- Frontend works without changes
- `npx prisma migrate status` shows clean state
- No `better-sqlite3` references remain in codebase

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Prisma async changes break sync route patterns | Low | Med | Routes already use async handlers |
| camelCase/snake_case mismatch breaks frontend | Med | High | Response mapper helper; test every endpoint |
| Docker postgres won't start (port conflict) | Low | Low | Don't expose postgres port externally |
| Existing SQLite data lost | Med | Med | Phase is for fresh installs; existing data is dev-only |

## Security Considerations
- `DATABASE_URL` with credentials: keep in env vars, never in code
- Postgres listens only on Docker internal network (no exposed port)
- Prisma parameterizes all queries (SQL injection safe)

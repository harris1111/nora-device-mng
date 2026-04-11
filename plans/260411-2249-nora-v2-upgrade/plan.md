---
title: "Nora Device Manager v2 Upgrade"
description: "Migrate SQLite to Postgres+Prisma, add S3 storage, attachments, device types/status, simplified transfers, maintenance history, and enhanced public page"
status: pending
priority: P1
effort: 32h
branch: main
tags: [migration, prisma, s3, postgres, full-stack]
created: 2026-04-11
---

# Nora Device Manager v2 Upgrade

## Overview

Major upgrade transforming the device management app from SQLite+BLOB to Postgres+Prisma+S3, adding device types, status tracking, attachments, maintenance history, and an enhanced public page.

## Architecture Changes

```
CURRENT:  Express → better-sqlite3 (file) → BLOB images
TARGET:   Express → Prisma ORM → PostgreSQL (Docker) + S3-compatible storage
```

## Data Flow (Target)

```
Client → Express routes → Prisma Client → PostgreSQL
                        → S3 Client    → S3 bucket (files)
```

## Dependency Graph

```
Phase 1 (Postgres+Prisma) ← Phase 2 (S3) ← Phase 3 (Attachments)
                           ← Phase 4 (Types/Status)
                           ← Phase 5 (Simplify Transfers)
Phase 3 + Phase 4         ← Phase 6 (Maintenance)
Phase 3 + Phase 4 + Phase 6 ← Phase 7 (Enhanced Public Page)
```

## Phase Summary

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 1 | SQLite → Postgres + Prisma | Pending | 6h | [phase-01](phase-01-postgres-prisma-migration.md) |
| 2 | S3-Compatible File Storage | Pending | 3h | [phase-02](phase-02-s3-file-storage.md) |
| 3 | Attachments System | Pending | 6h | [phase-03](phase-03-attachments-system.md) |
| 4 | Device Types & Status | Pending | 5h | [phase-04](phase-04-device-types-status.md) |
| 5 | Simplify Transfers | Pending | 3h | [phase-05](phase-05-simplify-transfers.md) |
| 6 | Maintenance/Repair History | Pending | 5h | [phase-06](phase-06-maintenance-history.md) |
| 7 | Enhanced Public Page | Pending | 4h | [phase-07](phase-07-enhanced-public-page.md) |

## Rollback Strategy

Each phase = separate branch + PR. If a phase fails:
- Revert the PR merge on main
- Prisma: `npx prisma migrate resolve --rolled-back <migration>`
- S3: objects are additive; no destructive changes until Phase 3 drops BLOB columns
- Docker: previous `docker-compose.yml` is in git history

## Backwards Compatibility

- Phase 1: No API contract changes. Frontend is unaffected.
- Phase 2: New env vars required (`S3_*`). Fallback: app won't start without them (fail-fast).
- Phase 3: Breaks `/api/devices/:id/image` endpoint temporarily — replaced with `/api/attachments/:id/file`. Migration script handles existing BLOBs.
- Phase 5: Drops `device_transfers` table — breaking change, but transfer history is intentionally removed per requirements.

## Test Matrix

| Layer | What | How |
|-------|------|-----|
| Unit | Prisma queries, S3 util, status logic | Manual verification via API calls |
| Integration | API endpoints CRUD | curl/Postman against running Docker stack |
| E2E | Full device lifecycle | Browser walkthrough: create → upload → transfer → maintain → public page |
| Migration | Data integrity after Prisma migrate | Compare row counts, verify BLOB→S3 migration |

## File Ownership Matrix

Tracks which phase owns (creates/modifies) each file to prevent conflicts in parallel work.

| File | P1 | P2 | P3 | P4 | P5 | P6 | P7 |
|------|----|----|----|----|----|----|-----|
| `prisma/schema.prisma` | C | - | M | M | M | M | - |
| `src/lib/prisma-client.js` | C | - | - | - | - | - | - |
| `src/lib/s3-client.js` | - | C | - | - | - | - | - |
| `src/utils/s3-config-validator.js` | - | C | - | - | - | - | - |
| `src/utils/response-mapper.js` | C | - | - | M | M | - | - |
| `src/utils/device-status-rules.js` | - | - | - | C | - | - | - |
| `src/utils/qrcode-generator.js` | - | - | - | - | - | - | M |
| `src/routes/device-routes.js` | M | - | M | M | M | - | M |
| `src/routes/location-routes.js` | M | - | - | - | - | - | - |
| `src/routes/public-routes.js` | M | - | - | - | - | - | M |
| `src/routes/attachment-routes.js` | - | - | C | - | - | - | - |
| `src/routes/maintenance-routes.js` | - | - | - | - | - | C | - |
| `src/index.js` | M | M | M | - | - | M | - |
| `docker-compose.yml` | M | M | - | - | - | - | - |
| `Dockerfile` | M | - | - | - | - | - | - |
| `src/database.js` | D | - | - | - | - | - | - |
| FE `device-form.jsx` | - | - | M | M | M | - | - |
| FE `device-detail-page.jsx` | - | - | M | M | M | M | - |
| FE `device-list-page.jsx` | - | - | M | M | - | - | - |
| FE `device-card.jsx` | - | - | M | M | - | - | - |
| FE `device-list-row.jsx` | - | - | M | M | - | - | - |
| FE `device-api.js` | - | - | M | M | M | - | - |
| FE `public-device-page.jsx` | - | - | - | - | - | - | M |
| FE `transfer-form.jsx` | - | - | - | - | D | - | - |
| FE `transfer-history.jsx` | - | - | - | - | D | - | - |

**Legend:** C=Create, M=Modify, D=Delete, -=Untouched

**Key constraint:** Phases 4 and 5 both modify `device-form.jsx`, `device-detail-page.jsx`, and `device-routes.js` — must execute sequentially (Phase 4 before 5).

## Recommended Execution Order

```
Phase 1 (must be first)
  → Phase 2
    → Phase 3
  → Phase 4 (can parallel with Phase 2)
    → Phase 5 (after Phase 4)
      → Phase 6 (after Phase 3 + 4)
        → Phase 7 (last)
```

Optimal parallel lanes:
- Lane A: Phase 1 → Phase 2 → Phase 3
- Lane B: Phase 1 → Phase 4 → Phase 5
- Merge → Phase 6 → Phase 7

## Environment Variables (Target)

```env
DATABASE_URL=postgresql://nora:nora@postgres:5432/nora_devices
S3_ENDPOINT=https://xxx.e2.example.com
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_REGION=us-east-1
S3_BUCKET=nora-devices
BASE_URL=http://localhost:13000
```

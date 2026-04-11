---
title: "Device Transfer Management & Extended Details"
description: "Add ownership/transfer tracking and extended info fields to devices"
status: pending
priority: P1
effort: 6h
branch: feat/device-transfer-and-details
tags: [feature, database, api, ui]
created: 2026-04-07
---

# Device Transfer Management & Extended Details

## Summary

Two features: (1) track device ownership (managed_by/owned_by) with transfer history, (2) add serial_number/model/manufacturer/description fields. Both require DB migration, API changes, and UI updates.

## Data Flow

```
[Device Form] --managed_by/owned_by/serial/model/etc--> [POST/PUT /api/devices] --> [devices table]
[Transfer Form] --to_owner/note/transferred_by--> [POST /api/devices/:id/transfer]
  --> INSERT into device_transfers + UPDATE devices.owned_by
[Detail Page] <-- GET /api/devices/:id (includes new fields)
              <-- GET /api/devices/:id/transfers (history list)
```

## Phase Overview

| # | Phase | Status | Effort | Files |
|---|-------|--------|--------|-------|
| 1 | [DB Migration & Models](phase-01-database-migration.md) | Pending | 1h | `backend/src/database.js` |
| 2 | [API Endpoints](phase-02-api-endpoints.md) | Pending | 1.5h | `backend/src/routes/device-routes.js` |
| 3 | [Frontend API Layer](phase-03-frontend-api.md) | Pending | 0.5h | `frontend/src/api/device-api.js` |
| 4 | [Device Form Update](phase-04-device-form.md) | Pending | 1h | `frontend/src/components/device-form.jsx` |
| 5 | [Device Detail + Transfer UI](phase-05-device-detail-transfer.md) | Pending | 2h | `frontend/src/pages/device-detail-page.jsx`, new: `frontend/src/components/transfer-form.jsx`, `frontend/src/components/transfer-history.jsx` |

## Dependency Graph

```
Phase 1 (DB) --> Phase 2 (API) --> Phase 3 (FE API) --> Phase 4 (Form)
                                                    --> Phase 5 (Detail + Transfer)
Phase 4 and Phase 5 are parallel (no file overlap).
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ALTER TABLE on existing DB with data | Medium | High | Use IF NOT EXISTS column check pattern already established in database.js |
| Transfer endpoint race condition (concurrent transfers) | Low | Medium | SQLite WAL + single-writer handles this; wrap transfer in transaction |
| Device form grows too large (>200 lines) | Medium | Low | New fields are simple inputs; form stays ~200 lines. Extract field groups if needed |

## Backwards Compatibility

- All new columns use DEFAULT '' or NULL -- existing devices unaffected
- No existing API contracts broken; new fields are additive
- managed_by/owned_by default to empty string; UI shows "Chưa gán" placeholder
- Transfer history empty for existing devices (no synthetic data needed)

## Rollback Plan

- Phase 1: SQLite columns cannot be dropped, but empty columns are harmless
- Phase 2-5: Revert git commits; no data loss since new columns are optional

## Test Matrix

| Layer | What | How |
|-------|------|-----|
| DB | Migration adds columns idempotently | Manual: run initDatabase() twice, verify no error |
| API | POST /api/devices/:id/transfer creates record + updates owned_by | curl / manual test |
| API | GET /api/devices/:id/transfers returns ordered history | curl / manual test |
| API | Device CRUD includes new fields in request/response | curl / manual test |
| UI | Form shows new fields, submits correctly | Browser test |
| UI | Detail page shows ownership, transfer button, history | Browser test |
| Edge | Transfer with empty to_owner returns 400 | curl |
| Edge | Transfer for nonexistent device returns 404 | curl |

## Success Criteria

1. Device create/edit form includes: managed_by, owned_by, serial_number, model, manufacturer, description
2. Device detail page displays all new fields
3. Transfer button opens form; submitting creates transfer record and updates owned_by
4. Transfer history timeline visible on detail page, ordered newest-first
5. Existing devices work without migration issues

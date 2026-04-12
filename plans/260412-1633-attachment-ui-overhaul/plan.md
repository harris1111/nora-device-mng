---
title: "Attachment System Overhaul & UI Modernization"
description: "Migrate device images from DB bytes to S3 primary attachments, replace gallery with list table, add inline PDF viewer, unify form uploads, fix maintenance types"
status: pending
priority: P1
effort: 16h
branch: feat/attachment-ui-overhaul
tags: [s3, attachments, ui, pdf, migration, maintenance]
created: 2026-04-12
---

# Attachment System Overhaul & UI Modernization

## Overview

Overhaul the attachment system: migrate device images from DB bytes to S3 primary attachments, replace gallery grid with a list/table, add inline PDF viewer (iframe modal), allow file uploads during device/maintenance creation in a single form, and clean up maintenance type inconsistencies.

## Architecture Changes

```
CURRENT:  Device.image (DB bytes) + Attachment gallery (S3) + separate upload step
TARGET:   All images as S3 Attachments + list table UI + inline PDF modal + single-form upload
```

## Key Decisions (from interview)

| Decision | Choice |
|----------|--------|
| Device image storage | Migrate DB bytes -> S3 primary attachment |
| Existing data | One-time migration script |
| PDF viewing | Modal overlay with browser native iframe |
| Attachment UI | List/table (name, type, size, actions) |
| Primary image display | Large preview above attachment list |
| Device form | Single form: separate "Primary Image" + "Attachments" sections |
| Primary image required | Optional |
| Edit primary | Replace old in S3 (delete + upload) |
| Maintenance cost | Remove from UI and types |
| Maintenance performed_by | Align to "technician" (match DB schema) |
| Maintenance attachments | Upload in create form (single submit) |
| Public page | Full attachments + inline PDF viewer |
| PDF library | Browser native iframe (zero dependencies) |

## Dependency Graph

```
Phase 1 (Schema + Migration) -> Phase 2 (Backend API)
Phase 2 -> Phase 3 (Shared Components)
Phase 3 -> Phase 4 (Device Form)
Phase 3 -> Phase 5 (Detail, Maintenance, Public Pages)
Phase 4 and Phase 5 are parallel (different files).
```

## Phase Summary

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 1 | Schema & Data Migration | Pending | 2h | [phase-01](phase-01-schema-data-migration.md) |
| 2 | Backend API Changes | Pending | 4h | [phase-02](phase-02-backend-api-changes.md) |
| 3 | Shared UI Components | Pending | 3h | [phase-03](phase-03-shared-ui-components.md) |
| 4 | Device Form Overhaul | Pending | 3h | [phase-04](phase-04-device-form-overhaul.md) |
| 5 | Detail, Maintenance & Public Pages | Pending | 4h | [phase-05](phase-05-detail-maintenance-public.md) |

## File Ownership Matrix

| File | P1 | P2 | P3 | P4 | P5 |
|------|----|----|----|----|-----|
| `backend/prisma/schema.prisma` | M | - | - | - | - |
| `backend/src/routes/device-routes.ts` | - | M | - | - | - |
| `backend/src/routes/attachment-routes.ts` | - | M | - | - | - |
| `backend/src/routes/maintenance-routes.ts` | - | M | - | - | - |
| `backend/src/routes/public-routes.ts` | - | M | - | - | - |
| `backend/src/utils/response-mapper.ts` | - | M | - | - | - |
| `backend/src/scripts/migrate-images.ts` | C | - | - | - | - |
| `frontend/src/api/device-api.ts` | - | - | - | M | M |
| `frontend/src/components/pdf-viewer-modal.tsx` | - | - | C | - | - |
| `frontend/src/components/attachment-list.tsx` | - | - | C | - | - |
| `frontend/src/components/attachment-gallery.tsx` | - | - | D | - | - |
| `frontend/src/components/device-form.tsx` | - | - | - | M | - |
| `frontend/src/components/maintenance-history.tsx` | - | - | - | - | M |
| `frontend/src/pages/device-detail-page.tsx` | - | - | - | - | M |
| `frontend/src/pages/public-device-page.tsx` | - | - | - | - | M |

**Legend:** C=Create, M=Modify, D=Delete

## Execution Order

```
Phase 1 (must be first - schema change)
  -> Phase 2 (backend depends on new schema)
    -> Phase 3 (shared components needed by phases 4+5)
      -> Phase 4 (device form) } parallel
      -> Phase 5 (detail/maintenance/public) } parallel
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Migration script fails mid-way | Low | High | Script is idempotent; tracks migrated devices; can re-run safely |
| S3 upload during form submit is slow | Medium | Low | Frontend shows upload progress; backend streams files |
| Multer field config breaks existing form | Low | Medium | Test with both old and new form payloads before deploying |
| iframe PDF viewer blocked by CSP | Low | Medium | S3 URLs are same-origin proxied through backend; no CSP issue |

## Rollback Strategy

- Phase 1: Migration script only adds attachments + doesn't drop columns until verified. Rollback = re-add columns via prisma db push
- Phase 2-5: Frontend-only changes, revert git commits
- S3 objects are additive; no data loss from rollback

## Test Matrix

| Layer | What | How |
|-------|------|-----|
| Migration | Images moved to S3 correctly | Run script, verify S3 objects + Attachment records |
| API | Device create with primary_image + attachments | curl multipart POST |
| API | Device update replaces primary in S3 | curl PUT, verify old S3 object deleted |
| API | Maintenance create with attachments | curl multipart POST |
| UI | PDF modal opens with iframe | Browser test with uploaded PDF |
| UI | Attachment list shows name/type/size/actions | Browser test |
| UI | Device form two-section upload works | Browser test create + edit |
| UI | Public page shows full attachments + PDF viewer | Browser test via QR scan |

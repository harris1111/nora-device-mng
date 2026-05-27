---
title: "Room Hierarchy Management"
description: "Add a location-scoped room tree with leaf-only room devices, duplicate workflows, and room UI without changing main-device behavior."
status: in-progress
priority: P1
effort: 5d
branch: dev2
tags: [rooms, hierarchy, prisma, rbac, frontend, backend]
blockedBy: []
blocks: []
created: 2026-05-27
---

# Room Hierarchy Management

## Overview

Ship a new `/rooms` module backed by one `RoomNode` adjacency table. Root and child nodes stay location-scoped for existing `UserLocation` RBAC, only leaf nodes may hold devices, and room devices reuse the existing `Device` model/detail/edit stack while staying hidden from the main `/devices` list/export flow. Existing RBAC, maintenance, inventory, and notifications are already live, so older unfinished plans are not blockers (`backend/src/middleware/require-permission.ts:14-37`, `backend/src/lib/maintenance-scheduler.ts:20-129`, `backend/src/routes/notification-routes.ts:7-80`).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Schema and RBAC](./phase-01-schema-and-rbac.md) | Done |
| 2 | [Room Backend Tree API](./phase-02-room-backend-tree-api.md) | Done |
| 3 | [Room Device and Duplicate Backend](./phase-03-room-device-and-duplicate-backend.md) | Done |
| 4 | [Frontend Room Tree Shell](./phase-04-frontend-room-tree-shell.md) | Done |
| 5 | [Frontend Room Device Workflows](./phase-05-frontend-room-device-workflows.md) | Done |
| 6 | [Validation and Documentation](./phase-06-validation-and-documentation.md) | Done |

## Locked Decisions

- Data model: one free-name `RoomNode` adjacency tree; no fixed levels, no `ltree`, no extra `isRoomDevice` flag.
- Scope/RBAC: `rooms` mirrors `devices` permissions; SADMIN/ADMIN full CRUD/export, USER view-only through room/location scope. Room trees and room devices authorize strictly by resolved room `locationId`; the current `transferTo` fallback must not grant room visibility.
- Device placement: only leaf rooms may contain devices; parent rooms aggregate descendant counts/status. The invariant is bidirectional: a room with direct devices cannot gain children, and a room with children cannot receive direct devices.
- Room status: `needs_maintenance` if any descendant device has `maintenance_status = needs_maintenance`, else `in_use`.
- Device reuse: room devices stay on the existing `Device` model, but any legacy `/api/devices/:id` surface that still serves room devices must enforce room authorization. Main list/export/bulk main-device surfaces must exclude `roomId != null`.
- Public exposure: room devices are internal only. Public device/attachment routes and QR/public flows must reject `roomId != null`.
- Move/delete: parent change happens via edit form selector only; block delete when a node still has child nodes or direct devices.
- Duplicate: clone selected room/subtree into target names; clone only allowed device scalar fields, never attachments, maintenance, inventory, transfer data, QR, or timestamps. `store_id` and `serial_number` stay exact copies by explicit business rule, so duplicate-safe handling must be documented anywhere `storeId` is treated as an operational key.

## Data Flow

- Input: `/api/rooms*` tree CRUD + duplicate requests, plus room-scoped device create/list/detail flows.
- Transform: `RoomNode` + `Device.roomId` in Prisma, `UserLocation` scope filters reused from current device behavior, derived breadcrumb text/status/counts returned from room APIs.
- Output: new `/rooms` UI, room-scoped device pages, and unchanged main-device pages that now default to `roomId = null`.

## Dependencies

1. Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 -> Phase 6.
2. No parallel phase execution. Shared files block concurrency: `backend/prisma/schema.prisma:94-170`, `backend/src/index.ts:67-87`, `backend/src/routes/device-routes.ts:56-599`, `frontend/src/App.tsx:39-67`, `frontend/src/api/device-api.ts:138-316`, `frontend/src/components/device/device-form.tsx:40-295`.
3. Backwards compatibility path:
   - Existing devices stay visible in `/devices` because they keep `roomId = null` (`backend/prisma/schema.prisma:133-170`).
   - Existing users get `rooms` permissions through seed upserts (`backend/prisma/seed.ts:10-22`, `41-51`).
   - Existing device notification links stay valid because device detail routes remain live (`backend/src/lib/maintenance-scheduler.ts:36-44`, `frontend/src/App.tsx:42-45`).

## Risk Snapshot

- High: Prisma schema push has no migration files. Mitigate with DB backup, explicit `npx prisma db push`, and a real rollback/data-cleanup runbook in Phase 1 before any later phase starts (`backend/package.json:9-12`, `Dockerfile:43`).
- High: room devices leaking into main list/export/filter/bulk flows. Mitigate by centralizing the default `roomId = null` filter in every main-device surface, not only list/export (`backend/src/routes/device-routes.ts:74-191`, `193-289`, `backend/src/routes/export-routes.ts:209-226`).
- High: duplicate accidentally recreates or leaks transfer semantics. Mitigate by removing transfer fields from the clone allowlist entirely and validating clones contain no transfer summary, no `TransferRecord`, and no transfer attachments (`backend/src/utils/transfer-records.ts:21-65`, `backend/src/utils/response-mapper.ts:9-37`).
- High: room-device legacy detail/edit reuse can bypass the new room boundary unless legacy device endpoints enforce room authorization when `roomId != null` (`backend/src/routes/device-routes.ts:318-337`, `444-524`).
- High: public QR/public-device/file routes are unauthenticated today, so room devices must be blocked from those paths instead of silently inheriting public exposure (`backend/src/utils/qrcode-generator.ts:2-8`, `backend/src/routes/public-routes.ts:6-198`).
- High: leaf-only room/device invariants can race under concurrent child-create and device-assign flows. Mitigate with transactional or locked invariant checks in both directions (`backend/src/routes/transfer-routes.ts:51-70`).
- Medium: room-only users can be stranded by the hardcoded `/ -> /devices` redirect. Mitigate with a first-allowed-module redirect in the frontend shell (`frontend/src/App.tsx:40-47`).

## Validation Summary

- Required commands: `cd backend && pnpm run db:generate`, `cd backend && pnpm run build`, `cd frontend && npx tsc --noEmit` (`backend/package.json:4-12`, `frontend/package.json:5-9`).
- Done means: room tree CRUD works within location scope, leaf-only invariant holds from both directions, room duplicate respects clone exclusions, room devices stay out of `/devices`, and room flows navigate without dropping back to main-device screens.
- Rollback principle: revert the current phase only after clearing any newly introduced room references/data that would block earlier contracts; phase files spell this out.

## Red Team Review

### Session — 2026-05-27
**Findings:** 8 (8 accepted, 0 rejected)
**Severity breakdown:** 2 Critical, 5 High, 1 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Room-device public exposure must be blocked | Critical | Accept | Plan, Phase 3, Phase 6 |
| 2 | Legacy `/api/devices/:id` reuse must enforce room auth | Critical | Accept | Plan, Phase 3, Phase 6 |
| 3 | Room visibility must use resolved `locationId`, not transfer fallback | High | Accept | Plan, Phase 2, Phase 3, Phase 6 |
| 4 | Duplicate must not clone transfer data | High | Accept | Plan, Phase 3 |
| 5 | Schema rollout must include `db push` + rollback runbook | High | Accept | Plan, Phase 1 |
| 6 | Leaf-only invariant needs bidirectional transactional enforcement | High | Accept | Plan, Phase 2, Phase 3 |
| 7 | Main-device bulk surfaces must exclude room devices | High | Accept | Plan, Phase 3, Phase 6 |
| 8 | `/` must redirect to first allowed module | Medium | Accept | Plan, Phase 4, Phase 6 |

### Whole-Plan Consistency Sweep
- Files reread: `plan.md`, `phase-01-schema-and-rbac.md`, `phase-02-room-backend-tree-api.md`, `phase-03-room-device-and-duplicate-backend.md`, `phase-04-frontend-room-tree-shell.md`, `phase-05-frontend-room-device-workflows.md`, `phase-06-validation-and-documentation.md`
- Decision deltas checked: 8
- Reconciled stale references: 3
- Unresolved contradictions: 0

## Unresolved Questions

None

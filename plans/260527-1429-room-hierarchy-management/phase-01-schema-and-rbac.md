---
phase: 1
title: "Schema and RBAC"
status: pending
effort: "1d"
---

# Phase 1: Schema and RBAC

## Overview

Lock the canonical data model before any route or UI work. The checked-in source of truth is still `backend/prisma/schema.prisma`, where `Device` has no room fields yet (`backend/prisma/schema.prisma:133-170`), while the generated client is stale and already exposes `RoomNode`, `Device.roomId`, and `isRoomDevice` (`backend/src/generated/prisma/models/RoomNode.ts:14-38`, `backend/src/generated/prisma/models/Device.ts:3429-3431`). This phase realigns schema, permissions, and generated types so later phases do not build on phantom fields.

## Requirements

- Add one adjacency-table model `RoomNode` with free-form names, nullable `parentId`, required `locationId`, and no fixed level enum.
- Allow duplicate room names; do not add a global or sibling-level unique constraint on `RoomNode.name` because breadcrumb text, not uniqueness, disambiguates rooms.
- Keep location scope explicit on every node so USER visibility can reuse the current `UserLocation` access model (`backend/prisma/schema.prisma:121-130`, `backend/src/routes/device-routes.ts:56-71`).
- Add nullable `Device.roomId`; do not add a redundant `isRoomDevice` flag because `roomId != null` is the single discriminator.
- Do not persist derived breadcrumb/status/count fields in schema. Those are API view concerns, not storage concerns.
- Seed a new `rooms` permission module with the same CRUD/export flags as `devices` for SADMIN/ADMIN and view-only for USER (`backend/prisma/seed.ts:10-22`, `41-51`).
- Surface `rooms` in the permission dashboard so admins can inspect/edit the module (`frontend/src/pages/permission-dashboard-page.tsx:5-10`, `69-118`).

## Architecture

Data flow for this phase:
1. Prisma schema defines `RoomNode`, `Location.roomNodes`, and `Device.roomId`.
2. `pnpm run db:generate` refreshes the generated client used by the app (`backend/package.json:4-12`).
3. Seed upserts a `rooms` permission row for each role (`backend/prisma/seed.ts:41-51`).
4. Auth keeps working without special-case code because permissions are already loaded dynamically from DB rows (`backend/src/routes/auth-routes.ts:13-20`, `65-71`).
5. Frontend permission dashboard reads the new module key from the existing matrix and renders it once labels/constants are updated (`frontend/src/pages/permission-dashboard-page.tsx:15-27`, `89-118`).

## Related Code Files

### Files to modify
- `backend/prisma/schema.prisma` — add `RoomNode`, `Location.roomNodes`, `Device.roomId`, and any required relation inverses (`backend/prisma/schema.prisma:94-170`)
- `backend/prisma/seed.ts` — extend module list and permission matrix (`backend/prisma/seed.ts:10-22`, `41-51`)
- `frontend/src/pages/permission-dashboard-page.tsx` — add `rooms` module label/column entry (`frontend/src/pages/permission-dashboard-page.tsx:5-10`, `89-118`)

### Files generated, never hand-edit
- `backend/src/generated/prisma/**` — replace only via `pnpm run db:generate`; strip generated `@ts-nocheck` after generation if it reappears (`backend/src/generated/prisma/models/RoomNode.ts:4`)

## Implementation Steps

1. Update `backend/prisma/schema.prisma`.
   - Add minimal `RoomNode` fields: `id`, `name`, `locationId`, `parentId`, `createdAt`, `updatedAt`, `createdById`, and `updatedById` so room writes can follow the same audit attribution pattern already used by `Location` and `Device` (`backend/prisma/schema.prisma:94-105`, `133-170`).
   - Add `Location.roomNodes` inverse relation so location deletes stay blocked by FK when room nodes exist.
   - Add `Device.roomId` + relation to `RoomNode`; keep it nullable for backwards compatibility with existing devices.
   - Do not add `path`, `status`, `code`, or `isRoomDevice` unless a later phase proves they are required. Current scope does not need them.
2. Apply schema and lock rollback before proceeding.
   - Run `cd backend && npx prisma db push` after schema edits because this repo deploy path uses schema push, not migration files (`CLAUDE.md:207-220`, `Dockerfile:43`).
   - Before phase signoff, define rollback steps that clear `Device.roomId`, delete `RoomNode` rows, and back out room-dependent permission rows if a revert is needed after schema push.
3. Regenerate Prisma client.
   - Run `cd backend && pnpm run db:generate`.
   - If generated files still contain `@ts-nocheck`, strip them before typecheck per current repo practice (`backend/src/generated/prisma/models/RoomNode.ts:4`).
4. Update RBAC seed defaults.
   - Append `rooms` to `MODULES` beside `devices`.
   - Add `rooms` flags to `PERMISSION_MATRIX` with `CRUD` for SADMIN/ADMIN and `VIEW_ONLY` for USER (`backend/prisma/seed.ts:10-22`).
4. Update the permission dashboard constants.
   - Add `rooms` to the `MODULES` list and `moduleLabels` map.
   - Keep `canExport` enabled only if the backend later exposes room export; the permission row still needs the flag now because the matrix model requires it.
5. Validate phase output.
   - `cd backend && npx prisma db push`
   - `cd backend && pnpm run db:generate`
   - `cd backend && pnpm run build`
   - `cd backend && pnpm run db:seed`
   - Verify `/api/auth/me` and `/api/permissions` expose the new `rooms` module after reseed.
   - `cd frontend && npx tsc --noEmit`

## Todo List

- [ ] Add canonical `RoomNode` schema and `Device.roomId`
- [ ] Keep `RoomNode.locationId` mandatory for scope enforcement
- [ ] Exclude redundant `isRoomDevice` from final schema
- [ ] Apply `npx prisma db push` before later phases
- [ ] Write schema rollback/data-cleanup runbook for pushed room schema
- [ ] Regenerate Prisma client and remove generated `@ts-nocheck` if present
- [ ] Seed `rooms` permissions for all roles
- [ ] Verify `/api/auth/me` and `/api/permissions` expose `rooms` after reseed
- [ ] Expose `rooms` in the permission dashboard
- [ ] Pass backend and frontend type checks

## Success Criteria

- `backend/prisma/schema.prisma` declares `RoomNode` and `Device.roomId`, and no final schema field named `isRoomDevice` exists.
- `npx prisma db push` completes and the rollback/data-cleanup procedure is written before later phases start.
- `backend/src/generated/prisma` matches the checked-in schema after regeneration; stale room shapes are gone or replaced by the new canonical ones.
- `backend/prisma/seed.ts` upserts `rooms` permissions with the locked role matrix.
- `/api/auth/me` and `/api/permissions` expose `rooms` after reseed.
- Admins can see a `rooms` row in the permission dashboard UI.
- `cd backend && pnpm run build` and `cd frontend && npx tsc --noEmit` both succeed.

## Risk Assessment

- High — stale generated Prisma types mask schema mistakes. Mitigation: treat generated files as disposable artifacts, regenerate immediately after schema edits, and grep for `isRoomDevice` before moving to Phase 2.
- Medium — adding the room relation can accidentally introduce delete cascades that violate the locked delete rule. Mitigation: keep room/device/location relations non-cascading and enforce deletion in route logic later.
- Medium — permission matrix drift between seed and dashboard. Mitigation: update both in the same phase and verify `/api/auth/me` returns a `rooms` key after reseeding.
- Rollback: revert schema + seed + permission dashboard changes, rerun `cd backend && pnpm run db:generate`, then rerun both typecheck commands.

## Security Considerations

- `RoomNode.locationId` is mandatory because USER access is location-scoped today; omitting it would create unscoped room trees.
- Do not trust generated client fields left over from prior abandoned work. Only schema-backed fields are security-relevant.
- Keep USER on `rooms:view` only. No create/update/delete widening in this phase.

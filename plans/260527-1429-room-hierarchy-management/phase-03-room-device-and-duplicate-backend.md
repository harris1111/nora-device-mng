---
phase: 3
title: "Room Device and Duplicate Backend"
status: pending
effort: "1d"
---

# Phase 3: Room Device and Duplicate Backend

## Overview

Extend the existing device backend so room devices reuse current CRUD/detail/edit behavior without polluting the main `/devices` module. This phase also adds room-scoped duplicate behavior that clones only approved device scalar fields. The current device list/export builders have no room filtering and would expose room devices unless changed (`backend/src/routes/device-routes.ts:193-289`, `backend/src/routes/export-routes.ts:209-226`). Device create/update currently require client-supplied `location_id` and optionally `area_id`, so room creation flows must override those fields server-side from the selected room (`backend/src/routes/device-routes.ts:343-441`, `443-567`).

## Requirements

- Hide room devices from the main `/api/devices` list, bulk actions, transfer-unit list, and export endpoints by default when `roomId != null`.
- Keep `GET /api/devices/:id`, `PUT /api/devices/:id`, attachments, maintenance, inventory, transfer, QR, and notifications working for room devices only if those legacy endpoints also enforce room authorization when `roomId != null`.
- Add room-scoped device endpoints that derive `location_id` and `room_id` from the selected room instead of trusting client-provided location fields.
- Enforce leaf-only placement: room device create/move must reject non-leaf target rooms, and room-tree writes must reject adding children under rooms with direct devices.
- Duplicate room workflow must clone room nodes and clone only allowed `Device` scalar fields. Never clone attachments, maintenance records, inventory records, transfer data, QR bytes, timestamps, or actor audit fields.
- Copy `store_id` and `serial_number` exactly during duplicate, while always generating a new database `id`. The plan must explicitly document that any code treating `storeId` as an operational identity key must stay duplicate-safe.
- Preserve location scoping during duplicate and reject source/target combinations outside the caller’s accessible locations.
- Block room devices from all unauthenticated public device/file routes and QR/public exposure flows.

## Architecture

Data flow for room device create/update:
1. Client calls a room-scoped endpoint such as `POST /api/rooms/:roomId/devices`.
2. Route validates `rooms:create` plus `devices:create` if room device creation is implemented as a device operation; leaf-room and location-scope checks happen before touching `Device`.
3. Server loads the target room, derives `locationId` from `RoomNode.locationId`, sets `roomId`, and reuses the existing device create logic shape (`backend/src/routes/device-routes.ts:343-407`).
4. Existing attachment, maintenance, inventory, transfer, QR, and notification flows continue to operate on the new device row because they all key off `deviceId`, but every room-device path must layer room authorization/public-route blocking on top of that reuse (`backend/src/routes/attachment-routes.ts:22-156`, `backend/src/routes/maintenance-routes.ts:22-339`, `backend/src/routes/inventory-routes.ts:22-311`, `backend/src/routes/transfer-routes.ts:25-123`, `backend/src/lib/maintenance-scheduler.ts:24-75`, `backend/src/lib/inventory-scheduler.ts:23-70`).
5. Duplicate clone logic must omit transfer-summary scalars entirely so it cannot materialize or expose transfer state through fallback mapping (`backend/src/utils/transfer-records.ts:21-65`, `backend/src/utils/response-mapper.ts:9-37`).

Data flow for duplicate:
1. Client requests duplicate against a source room or subtree.
2. Backend loads source nodes + direct room devices.
3. Transaction creates new room nodes first, remaps parent IDs, then creates cloned device rows with a strict scalar whitelist.
4. Response returns created room/device counts and new IDs for navigation.

## Related Code Files

### Files to modify
- `backend/src/routes/device-routes.ts` — central query builders, create/update/detail access, and possibly shared helpers (`backend/src/routes/device-routes.ts:56-71`, `193-289`, `317-599`)
- `backend/src/routes/export-routes.ts` — ensure filtered exports stay main-device only unless a dedicated room export exists (`backend/src/routes/export-routes.ts:178-226`)
- `backend/src/utils/response-mapper.ts` — include `room_id` and room breadcrumb/name fields in device responses if required by UI (`backend/src/utils/response-mapper.ts:39-67`)
- `backend/src/routes/attachment-routes.ts` — room-device access checks if attachment operations must verify room scope beyond generic device lookup (`backend/src/routes/attachment-routes.ts:22-156`)
- `backend/src/routes/maintenance-routes.ts` — room-device access checks for maintenance history (`backend/src/routes/maintenance-routes.ts:22-339`)
- `backend/src/routes/inventory-routes.ts` — room-device access checks for inventory history (`backend/src/routes/inventory-routes.ts:22-311`)
- `backend/src/routes/transfer-routes.ts` — room-device access checks for transfer attachments (`backend/src/routes/transfer-routes.ts:25-123`)

### Files to create or extend
- `backend/src/routes/room-routes.ts` or a room service helper from Phase 2 — add room duplicate and room-device endpoints there
- Optional helper such as `backend/src/utils/room-device-access.ts` to centralize leaf-room and location checks

## Implementation Steps

1. Centralize “main device” filtering.
   - Update `buildDeviceListWhere()` to default to `roomId: null` for main `/api/devices` queries while leaving a controlled opt-in path for room-scoped listing (`backend/src/routes/device-routes.ts:193-260`).
   - Ensure `GET /api/devices/transfer-units`, main-device bulk edit/delete, and both export endpoints reuse the same main-device exclusion (`backend/src/routes/device-routes.ts:74-191`, `299-315`, `backend/src/routes/export-routes.ts:191-226`).
2. Add room-aware device access helper.
   - Split room-device auth from the flat-device `transferTo` fallback. For room devices, authorize strictly from the resolved room/location chain, not from transfer summary fields (`backend/src/routes/device-routes.ts:56-71`, `326-334`).
   - Extend it so room-scoped actions confirm the device belongs to the requested room and accessible location.
   - Apply the same helper to any legacy `/api/devices/:id` surface that still serves room devices.
3. Add room device endpoints.
   - `GET /api/rooms/:roomId/devices` for room-only device listing.
   - `POST /api/rooms/:roomId/devices` to create a room device while deriving `locationId` and `roomId` from the room, ignoring any conflicting client `location_id`.
   - Optional `POST /api/rooms/:roomId/devices/:deviceId/move` or reuse device update logic to reassign room by selected parent/room; always reject non-leaf targets.
   - Protect room-device assign/create and room-child create/move with one transaction or lock so concurrent writes cannot violate the leaf-only invariant.
4. Adapt existing device detail/update handlers.
   - Keep `/api/devices/:id` detail/edit responses available for room devices only if those handlers enforce room authorization when `roomId != null`.
   - Make sure location-scope checks still work when `roomId != null`; room devices should not disappear from valid detail/edit flows.
   - Legacy update handlers must ignore conflicting client `location_id` / `room_id` for room devices and recompute them from the validated room contract.
5. Implement duplicate endpoint.
   - Add `POST /api/rooms/:id/duplicate` or equivalent batch endpoint in `room-routes.ts`.
   - Duplicate room nodes first, then clone direct devices with a strict allowlist: `storeId`, `name`, `areaId` if still used, `managedBy`, `serialNumber`, `model`, `manufacturer`, `description`, `type`, `status`, `disposalDate`, `lossDate`, `warrantyPeriod`, `maintenanceStatus`, `inventoryStatus`, `locationId`, `roomId`.
   - Insert cloned devices directly with that scalar payload plus a new `id`; do not call `syncDeviceTransferRecord()` during duplicate.
   - Explicitly omit `ownedBy`, `transferTo`, `transferDate`, `id`, `qrcode`, `createdAt`, `createdById`, `updatedById`, relation arrays, schedules, attachment rows, and transfer-record rows (`backend/src/routes/device-routes.ts:381-407`, `backend/src/utils/transfer-records.ts:21-65`).
   - Regenerate QR codes only if room devices are still allowed to have internal-only QR assets; do not route cloned room devices into unauthenticated public device pages (`backend/src/routes/device-routes.ts:373-375`, `488-489`, `backend/src/utils/qrcode-generator.ts:2-8`).
   - Document and validate that exact-copy `storeId`/`serialNumber` duplicates are allowed by business rule and that any `storeId`-based seed/sync logic remains safe (`backend/prisma/seed.ts:79-90`).
6. Protect downstream workflows.
   - Block room devices from `/api/public/device/:id` and all `/api/public/*attachments/:id/file` routes even if core device flows are reused internally (`backend/src/routes/public-routes.ts:6-198`).
   - Validate that maintenance/inventory/transfer/attachment routes can still reach room devices once created; add shared access checks where endpoint authorization currently trusts only `deviceId` existence (`backend/src/routes/attachment-routes.ts:45-87`, `backend/src/routes/maintenance-routes.ts:50-138`, `backend/src/routes/inventory-routes.ts:49-125`, `backend/src/routes/transfer-routes.ts:25-90`).
7. Validate.
   - `cd backend && pnpm run build`
   - Smoke test main device list/export/bulk exclusion plus room-device create/detail/edit/duplicate paths.
   - Smoke test that public device/file routes reject room devices.
   - Validate that maintenance/inventory/transfer/attachment routes can still reach room devices once created; add shared access checks where endpoint authorization currently trusts only `deviceId` existence (`backend/src/routes/attachment-routes.ts:45-87`, `backend/src/routes/maintenance-routes.ts:50-138`, `backend/src/routes/inventory-routes.ts:49-125`, `backend/src/routes/transfer-routes.ts:25-90`).

## Todo List

- [ ] Default main device queries to `roomId = null`
- [ ] Keep detail/edit APIs valid for room devices with room authorization checks
- [ ] Add room device list/create endpoints with server-derived `locationId`
- [ ] Enforce bidirectional leaf-only room placement
- [ ] Add transactional or locked checks around room-device and room-tree writes
- [ ] Implement room duplicate transaction with device whitelist cloning
- [ ] Exclude attachments, history, schedules, transfer data, QR/public exposure, and timestamps from clones
- [ ] Recheck attachment/maintenance/inventory/transfer room-device access
- [ ] Block room devices from all public device/file routes
- [ ] Pass backend build

## Success Criteria

- Main `/api/devices` list, transfer-unit filter values, Excel export, and main-device bulk surfaces no longer include room devices.
- Room device create ignores conflicting client location input and persists the room’s `locationId` + `roomId`.
- Room device detail/edit continues through existing device endpoints only with room authorization enforced when `roomId != null`.
- Duplicate room creates new room IDs and new device IDs while copying `store_id` and `serial_number` exactly.
- No cloned attachment, maintenance, inventory, transfer, notification, schedule, or public-device exposure artifacts exist after duplicate.
- Public device/file routes reject room devices.
- `cd backend && pnpm run build` succeeds.

## Risk Assessment

- High — missing one shared device query leaks room devices back into main UI/export/bulk flows. Mitigation: inventory every entry point that uses `buildDeviceListWhere()` or independent `prisma.device.findMany()`/update/delete paths and update each explicitly (`backend/src/routes/device-routes.ts:74-191`, `272-280`, `299-315`, `320-336`, `343-599`, `backend/src/routes/export-routes.ts:195-226`).
- High — clone whitelist accidentally recreates transfer semantics or leaks transfer summary. Mitigation: remove transfer fields from the allowlist and verify clones have no transfer summary, no `TransferRecord`, and no transfer attachments (`backend/src/utils/transfer-records.ts:21-65`, `backend/src/utils/response-mapper.ts:9-37`).
- High — room devices can silently inherit unauthenticated public exposure through QR/public routes. Mitigation: make public-route rejection for `roomId != null` a required deliverable in this phase (`backend/src/utils/qrcode-generator.ts:2-8`, `backend/src/routes/public-routes.ts:6-198`).
- High — leaf-only invariants can race under concurrent child-create and room-device writes. Mitigation: put invariant checks and writes in one transaction or lock and return conflict on contention (`backend/src/routes/transfer-routes.ts:51-70`).
- Medium — room device access checks duplicated across attachment/maintenance/inventory/transfer endpoints can drift. Mitigation: extract a shared device access helper once the second endpoint needs the same logic.
- Medium — duplicate can create many devices in one transaction. Mitigation: batch by room subtree size limits and reject oversized requests early.
- Rollback: remove room-specific endpoints and duplicate helper, restore main device query behavior, remove room-device public-route blocks only if the room schema is also rolled back, then rerun backend build.

## Security Considerations

- Never trust room-device create payload `location_id` or `room_id`; derive both from the validated room row.
- Room duplicate must stay within caller-visible locations and return 404 for inaccessible source rooms, mirroring current concealment patterns.
- Attachment/maintenance/inventory/transfer endpoints currently trust device existence plus module permission; extend them carefully so room devices do not bypass location scope.
- Duplicate logic must use an explicit allowlist, not object spread from raw Prisma device rows, to avoid silently copying relations or hidden fields.

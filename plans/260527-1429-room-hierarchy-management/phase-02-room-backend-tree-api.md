---
phase: 2
title: "Room Backend Tree API"
status: pending
effort: "1d"
---

# Phase 2: Room Backend Tree API

## Overview

Build the room hierarchy API after schema/RBAC is stable. This phase adds the `/api/rooms` route family, mounts it into the server, enforces location-scoped USER visibility, returns breadcrumb/path text for duplicate names, supports parent changes through edit payloads, and computes derived room status/counts from descendants without storing extra room state. Existing device route location filtering is the source pattern to reuse, not replace (`backend/src/routes/device-routes.ts:56-71`, `255-260`, `326-334`).

## Requirements

- Add authenticated room endpoints for list/tree/detail/create/update/delete and optional export only if export is truly implemented in scope.
- Return enough room payload for UI tree rendering: `id`, `name`, `location_id`, `parent_id`, `breadcrumb`, `device_count`, `descendant_device_count`, `status`, `has_children`, `is_leaf`, and children for the tree response.
- Expose breadcrumb/path text in API responses because duplicate names are allowed.
- Enforce USER visibility through assigned locations by resolved room `locationId` only. Do not reuse the current `transferTo` fallback as room authorization (`backend/prisma/schema.prisma:121-130`, `backend/src/routes/device-routes.ts:56-71`).
- Block cross-location parent changes by validating `newParent.locationId === current.locationId`.
- Enforce the leaf-only invariant in both directions: later room-device APIs may only target leaves, and room create/move APIs must reject placing children under rooms that already have direct devices.
- Block delete if the node still has child nodes or direct devices.
- Require transactional or locked checks around parent-change/child-create writes so concurrent operations cannot violate leaf-only structure.

## Architecture

Data flow for this phase:
1. Request enters `backend/src/index.ts` and is routed under `/api/rooms` after `requireAuth` (`backend/src/index.ts:71-87`).
2. `requirePermission('rooms', action)` gates module access using the same dynamic DB lookup as existing modules (`backend/src/middleware/require-permission.ts:14-37`).
3. Route layer resolves current user location scope by reusing the device-route pattern of assigned location IDs/names (`backend/src/routes/device-routes.ts:56-71`).
4. Room service/query helpers fetch room nodes for the allowed locations, build breadcrumb strings from parent chains, and compute descendant summaries via recursive traversal or recursive CTE.
5. Response mapper returns snake_case payloads consistent with the rest of the API (`backend/src/utils/response-mapper.ts:39-67`, `69-83`).

Derived status rules:
- `needs_maintenance` if any descendant device has `maintenanceStatus = 'needs_maintenance'` (`backend/src/lib/maintenance-scheduler.ts:77-108`).
- Else `in_use`.
- Do not include inventory status in room status. Scope is locked to maintenance only.

## Related Code Files

### Files to modify
- `backend/src/index.ts` — mount room routes (`backend/src/index.ts:71-87`)
- `backend/src/middleware/require-permission.ts` — no behavior change expected; only consume existing middleware (`backend/src/middleware/require-permission.ts:14-37`)
- `backend/src/utils/response-mapper.ts` — add room mappers or create a focused room mapper module if file size forces split (`backend/src/utils/response-mapper.ts:39-83`)

### Files to create or extend
- `backend/src/routes/room-routes.ts` — primary hierarchy endpoints, following route patterns from `location-routes.ts` and `device-routes.ts` (`backend/src/routes/location-routes.ts:8-90`, `backend/src/routes/device-routes.ts:193-599`)
- Optional helper module if needed to keep route file under control, e.g. `backend/src/utils/room-tree.ts` or `backend/src/utils/room-access.ts`

## Implementation Steps

1. Create room access helpers.
   - Extract the USER location-scope pattern from `device-routes.ts` into a reusable helper or duplicate it carefully if extraction would expand shared blast radius (`backend/src/routes/device-routes.ts:56-71`).
   - Helper must return allowed `locationId[]` for rooms; unlike devices, transfer-name fallback is forbidden for rooms.
2. Add room query/shape helpers.
   - Build breadcrumb text by traversing parent links and joining names with a stable delimiter.
   - Compute `has_children` from child counts and `is_leaf = !has_children`.
   - Compute `descendant_device_count` and `status` from descendants using recursive traversal or a recursive CTE; avoid `ltree` and raw extension dependencies.
3. Implement endpoints in `room-routes.ts`.
   - `GET /api/rooms/tree`: full nested tree for all accessible locations.
   - `GET /api/rooms`: flat room list for selectors/search.
   - `GET /api/rooms/:id`: room detail with breadcrumb + summary.
   - `POST /api/rooms`: create node after validating location, optional parent, same-location parent constraint, and “parent has no direct devices” invariant.
   - `PUT /api/rooms/:id`: rename/move node via `parent_id` field; reject self-parent cycles, cross-location moves, and moves under rooms with direct devices.
   - `DELETE /api/rooms/:id`: reject when child nodes or direct devices exist.
   - Wrap create/move writes in one transaction or lock so child-create/move races cannot bypass the leaf-only invariant.
4. Mount routes in `backend/src/index.ts` under `app.use('/api/rooms', requireAuth, roomRoutes)` beside devices/locations.
5. Add mapper coverage.
   - Extend current mapping utilities or split out room mappers if `response-mapper.ts` would exceed the repo guideline (`docs/code-standards.md:18-25`, `170-191`).
6. Validate.
   - `cd backend && pnpm run build`
   - Manual smoke checklist for RBAC + tree shape.

## Todo List

- [ ] Add room route module and mount it in `index.ts`
- [ ] Reuse USER location scoping for every room read/write
- [ ] Return breadcrumb text on tree, list, and detail responses
- [ ] Enforce same-location parent moves only
- [ ] Block cycles, self-parent, delete-with-children, and delete-with-devices
- [ ] Compute descendant device counts and maintenance-derived status
- [ ] Keep API payloads in snake_case
- [ ] Pass backend build

## Success Criteria

- `/api/rooms/tree` returns only rooms in locations the caller can access.
- Duplicate room names are distinguishable through breadcrumb text in API responses.
- Parent change works through `PUT /api/rooms/:id` and rejects cross-location or cyclic moves.
- Delete returns a conflict when a room still has child rooms or direct devices.
- Room payload status flips to `needs_maintenance` when any descendant room device is overdue/flagged, otherwise `in_use`.
- `cd backend && pnpm run build` succeeds.

## Risk Assessment

- High — USER scope drift between room routes and device routes could expose hidden room trees. Mitigation: share or faithfully mirror the same location-assignment lookup used in `device-routes.ts`.
- High — descendant aggregation can become N+1-heavy on large trees. Mitigation: prefer one recursive query/traversal per request and memoize descendant summaries inside the request scope.
- Medium — breadcrumb generation can recurse forever if a cycle slips in. Mitigation: cycle guards during update and defensive visited-set checks in breadcrumb builders.
- Medium — route file growth. Mitigation: extract room tree/access helpers once the file crosses the repo’s maintainability threshold.
- Rollback: unmount `/api/rooms`, remove route/helper modules, remove room mapper exports, rerun backend build.

## Security Considerations

- Every room endpoint must apply both `requirePermission('rooms', action)` and location-scope validation; permission alone is not sufficient for USER.
- Room detail must return 404, not 403, when a USER requests an inaccessible room, mirroring the current device-detail concealment approach (`backend/src/routes/device-routes.ts:326-334`).
- Do not trust `parent_id` or `location_id` from clients without validating existence and same-location invariants server-side.
- Keep exported breadcrumb text plain strings; no HTML markup in API payloads.

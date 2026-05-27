---
phase: 5
title: "Frontend Room Device Workflows"
status: pending
effort: "1d"
---

# Phase 5: Frontend Room Device Workflows

## Overview

Wire the room workspace to actual device and room actions. Existing device pages/components are tightly bound to the global `/devices` module: create/edit/detail navigation points back to `/devices`, cards and rows link to `/devices/:id`, and `DeviceForm` requires an editable location picker (`frontend/src/pages/device-create-page.tsx:7-9`, `15-20`, `28`; `frontend/src/pages/device-edit-page.tsx:22-25`, `49-55`, `68`; `frontend/src/pages/device-detail-page.tsx:37-45`, `136-153`, `250-321`; `frontend/src/components/device/device-card.tsx:48-49`, `81-83`; `frontend/src/components/device/device-list-row.tsx:48-49`, `90-96`; `frontend/src/components/device/device-form.tsx:40-43`, `55-67`, `132-164`). This phase reuses device business behavior while keeping room-device navigation inside `/rooms`.

## Requirements

- Show devices for the selected room inside the room module only; room devices must not route users back through the main `/devices` list.
- Add room-context routes for device create/detail/edit, using existing device model/detail/edit behavior with room-aware navigation.
- Lock or hide location controls in room-device create/edit forms because backend derives `location_id` and `room_id` from the selected room (`frontend/src/components/device/device-form.tsx:55-67`, `132-164`).
- Reuse existing attachments, maintenance, inventory, transfer, and QR sections for room devices where possible (`frontend/src/pages/device-detail-page.tsx:250-321`).
- Add room create/edit/delete/duplicate actions in the room workspace, including parent-selector editing and duplicate-range UX.
- Surface backend constraint failures clearly: delete blocked by child rooms/devices, move blocked by cross-location or cycle rules, create blocked on non-leaf target, duplicate blocked on invalid range/permission.

## Architecture

Frontend workflow split:
1. Room tree page selects a room and fetches its device list from room-scoped APIs added in Phase 3.
2. Device list panel renders room-device cards/rows using the same visual primitives as the main device list, but with room-scoped detail links.
3. `Create room device` opens a room-context page using `DeviceForm` with locked room/location context.
4. `Room device detail` reuses current detail sections for attachments, transfer info, maintenance, inventory, and QR, but back/edit/delete actions resolve to `/rooms/:roomId/...` instead of `/devices/...` (`frontend/src/pages/device-detail-page.tsx:136-153`, `175-182`, `250-321`).
5. Room edit and duplicate actions stay inside the room workspace, then refresh the tree and selected room detail.

Key reuse rule:
- Reuse device domain components.
- Do not reuse `DeviceListPage` as-is because it is globally filtered, search-param driven, and coupled to main-device links (`frontend/src/pages/device-list-page.tsx:154-169`, `215-239`, `371-513`; `frontend/src/components/device-filter-bar.tsx:92-388`).

## Related Code Files

### Files to modify
- `frontend/src/App.tsx` — add room-device subroutes under `/rooms` (`frontend/src/App.tsx:39-67`)
- `frontend/src/api/device-api.ts` — add room-device request helpers if still the shared API module (`frontend/src/api/device-api.ts:138-316`)
- `frontend/src/components/device/device-form.tsx` — accept locked room/location context and hide location controls when invoked from rooms (`frontend/src/components/device/device-form.tsx:14-18`, `40-43`, `55-67`, `132-164`)
- `frontend/src/components/device/device-card.tsx` — make detail href configurable or add room-context wrapper (`frontend/src/components/device/device-card.tsx:43-50`, `79-83`)
- `frontend/src/components/device/device-list-row.tsx` — same configurable detail href requirement (`frontend/src/components/device/device-list-row.tsx:42-50`, `89-97`)
- `frontend/src/pages/device-detail-page.tsx` — extract reusable content or add route-context props so room detail can keep room navigation (`frontend/src/pages/device-detail-page.tsx:37-45`, `136-153`, `250-321`)
- `frontend/src/pages/device-edit-page.tsx` — same route-context adaptation for room edit (`frontend/src/pages/device-edit-page.tsx:22-25`, `49-55`, `68`)
- `frontend/src/pages/device-create-page.tsx` — reuse patterns or extract submit shell if helpful (`frontend/src/pages/device-create-page.tsx:7-9`, `15-20`, `28`)

### Files to create or extend
- `frontend/src/pages/room-device-create-page.tsx`
- `frontend/src/pages/room-device-detail-page.tsx`
- `frontend/src/pages/room-device-edit-page.tsx`
- `frontend/src/components/rooms/room-device-list-panel.tsx`
- `frontend/src/components/rooms/room-editor-modal.tsx`
- `frontend/src/components/rooms/room-duplicate-modal.tsx`

## Implementation Steps

1. Add room-device routes.
   - Register `/rooms/:roomId/devices/new`, `/rooms/:roomId/devices/:deviceId`, and `/rooms/:roomId/devices/:deviceId/edit` in `App.tsx`.
   - Keep these routes behind `rooms:view`; create/edit also need client-side action gating with `useCan('rooms', ...)` and/or `useCan('devices', ...)` depending on the backend contract.
2. Build the room device list panel.
   - Fetch room devices from the Phase 3 endpoint, not from `getDevices()`.
   - Reuse card/table presentation patterns but inject room-scoped detail links instead of the hardcoded `/devices/${id}` links in current components (`frontend/src/components/device/device-card.tsx:48-49`, `81-83`; `frontend/src/components/device/device-list-row.tsx:48-49`, `90-96`).
   - Keep filters lightweight and room-relevant; selected room already fixes location.
3. Adapt `DeviceForm` for room context.
   - Add props such as `lockedLocationId`, `lockedLocationName`, `lockedRoomId`, and `hideLocationFields`.
   - Preload locked location state so required validation still passes without a visible location picker (`frontend/src/components/device/device-form.tsx:55-67`, `88-89`, `132-164`).
   - Do not silently change non-room create/edit behavior.
4. Implement room device create/edit pages.
   - Room create page submits to the room-scoped backend endpoint and navigates to `/rooms/:roomId/devices/:deviceId` after success instead of `/devices/:id` (`frontend/src/pages/device-create-page.tsx:7-9`).
   - Room edit page reuses existing load/update behavior but keeps back navigation within the room route (`frontend/src/pages/device-edit-page.tsx:22-25`, `49-55`).
5. Implement room device detail page.
   - Reuse the current detail sections for transfer info, attachments, maintenance, and inventory (`frontend/src/pages/device-detail-page.tsx:250-321`).
   - Override back, edit, and delete navigation so users return to the selected room, not the main device list (`frontend/src/pages/device-detail-page.tsx:37-45`, `136-153`, `175-182`).
6. Add room action workflows to the shell.
   - `Create room`: modal or page with name + parent + location-aware validation.
   - `Edit room`: modal with editable name and parent selector; no drag-and-drop.
   - `Delete room`: confirm dialog that surfaces backend block reasons.
   - `Duplicate room`: modal collecting target parent plus range inputs (`prefix`, `start`, `end`, optional zero-padding) and showing a generated preview before submit.
7. Refresh and routing behavior.
   - After room create/move/delete/duplicate, refresh tree + selected room state deterministically.
   - After room duplicate, auto-select the first created room or stay on source room and show a success summary; pick one behavior and keep it consistent.
8. Validate.
   - `cd frontend && npx tsc --noEmit`
   - Manual flow check: select room -> add device -> open detail -> edit -> upload attachment -> add maintenance/inventory -> delete device -> return to room.

## Todo List

- [ ] Add room-device routes under `/rooms`
- [ ] Render selected-room device list with room-scoped links
- [ ] Adapt `DeviceForm` to lock/hide location fields for room context
- [ ] Add room device create/detail/edit pages with room-safe navigation
- [ ] Reuse detail sections for attachments, transfer, maintenance, inventory, and QR
- [ ] Add room create/edit/delete/duplicate UI actions
- [ ] Surface backend constraint errors in modals/forms
- [ ] Pass frontend typecheck

## Success Criteria

- A user can select a leaf room, view its devices, add a device, open that device, edit it, and return to the room without entering the main `/devices` workflow.
- Location fields are hidden or read-only in room-device create/edit pages, and the UI displays the derived room/location context clearly.
- Room duplicate UI can generate a preview for a requested range and refresh the tree after success.
- Existing detail subfeatures still work on room devices: attachments, transfer files, maintenance, inventory, and QR display.
- `cd frontend && npx tsc --noEmit` succeeds.

## Risk Assessment

- High — current device pages hardcode `/devices` navigation, so partial reuse will strand users in the wrong module. Mitigation: parameterize navigation targets or build room wrappers that own back/edit/delete URLs.
- Medium — `DeviceForm` already exceeds the repo’s preferred file size (`frontend/src/components/device/device-form.tsx:13-312`; `docs/code-standards.md:18-25`). Mitigation: prefer a narrow prop-driven refactor or small extracted sections instead of piling more conditional JSX into one block.
- Medium — reusing `DeviceListPage` would drag in irrelevant global filters and main-device assumptions. Mitigation: create a focused room-device list panel and reuse only the presentational subcomponents that can be made route-aware.
- Medium — duplicate-range UI can confuse users if preview is absent. Mitigation: always render the destination names/paths before submit and validate start/end locally before calling the API.
- Rollback: remove room-device pages/routes/components, revert device component props, rerun frontend typecheck.

## Security Considerations

- Client must never submit editable location data for room-device flows without clearly marking it derived; backend remains authoritative, but the UI should reduce misleading input.
- Hide create/edit/delete/duplicate controls when the permission matrix disallows them, even though backend enforcement remains the real guard.
- When backend returns 404/409 for inaccessible or blocked rooms, keep the error messaging generic enough to avoid leaking hidden room structure outside authorized scope.

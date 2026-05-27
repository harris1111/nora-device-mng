---
phase: 4
title: "Frontend Room Tree Shell"
status: pending
effort: "1d"
---

# Phase 4: Frontend Room Tree Shell

## Overview

Build the new `/rooms` navigation shell and tree workspace without yet wiring full room-device create/edit flows. Current routing and navigation are device-first: `/` redirects to `/devices`, `AppLayout` only knows the existing modules, and page chrome derives titles from hardcoded path checks (`frontend/src/App.tsx:39-67`, `frontend/src/components/layout/app-layout.tsx:42-69`, `75-166`). This phase introduces the rooms tab, route guards, tree page layout, breadcrumb rendering, and location-scoped room summaries.

## Requirements

- Add a dedicated `/rooms` route family protected by `PermissionRoute module="rooms" action="view"` like existing modules (`frontend/src/App.tsx:46-66`, `frontend/src/components/auth/permission-route.tsx:13-27`).
- Add a “Phòng” nav entry in `AppLayout` that respects `useCan('rooms', 'view')` like the existing nav items (`frontend/src/components/layout/app-layout.tsx:62-69`, `75-166`).
- Update page-title metadata so `/rooms`, `/rooms/:id`, and room sub-routes show correct headings (`frontend/src/components/layout/app-layout.tsx:42-55`).
- Create a room page shell with tree panel + detail panel, designed for duplicate names through breadcrumb/path text from the API.
- Show room summaries: breadcrumb, status, child count, direct device count, descendant device count, and actions allowed by permission.
- Keep file ownership isolated from later room-device workflow work: this phase owns route registration, layout/nav, room API client types, and room shell page/components only.

## Architecture

Frontend data flow:
1. Router resolves `/rooms` into a new room workspace page under `AdminLayout` (`frontend/src/App.tsx:39-67`).
2. `AppLayout` exposes the room nav item when the loaded permission matrix includes `rooms.view` (`frontend/src/components/layout/app-layout.tsx:62-69`, `75-166`; `frontend/src/hooks/use-permission.ts:1-5`).
3. Room workspace fetches `/api/rooms/tree` and optional `/api/rooms/:id` detail via the central API client module pattern used by devices (`frontend/src/api/device-api.ts:138-316`).
4. Tree selection drives detail-panel state; breadcrumb text from the backend resolves duplicate names.
5. Shell actions route into later workflows: create room, edit room parent, duplicate room, and room-device actions stubbed for Phase 5.

State strategy:
- Use URL route params for selected room identity.
- Keep transient UI state such as expanded tree nodes local to the room page unless sharing proves necessary.
- Do not add a new global state library.

## Related Code Files

### Files to modify
- `frontend/src/App.tsx` — add room routes (`frontend/src/App.tsx:39-67`)
- `frontend/src/components/layout/app-layout.tsx` — add nav item and page metadata (`frontend/src/components/layout/app-layout.tsx:42-55`, `75-166`)
- `frontend/src/api/device-api.ts` — extend with room API interfaces/functions unless split into a room-specific API module under the same folder (`frontend/src/api/device-api.ts:1-316`)

### Files to create or extend
- `frontend/src/pages/room-list-page.tsx` or `room-tree-page.tsx` — primary room workspace page
- `frontend/src/components/rooms/**` — room tree, room summary panel, empty state, action bar; keep filenames kebab-case

## Implementation Steps

1. Extend permission-aware routing.
   - Add `/rooms` and `/rooms/:id` routes under `AdminLayout`, wrapped by `PermissionRoute module="rooms" action="view"` (`frontend/src/App.tsx:46-66`).
   - Change `/` to redirect to the first allowed module instead of always `/devices`; `/rooms` must be a valid fallback when `devices:view` is missing.
   - Gate `/devices` intentionally if the app wants to avoid stranding room-only users on a screen they cannot use.
2. Update `AppLayout`.
   - Add `canViewRooms = useCan('rooms', 'view')`.
   - Insert a room nav item with consistent iconography and mobile-nav support (`frontend/src/components/layout/app-layout.tsx:75-166`, `320-341`).
   - Extend `getPageMeta()` for `/rooms` paths (`frontend/src/components/layout/app-layout.tsx:42-55`).
3. Define room API contracts.
   - Add typed interfaces for `RoomNodeSummary`, `RoomTreeNode`, and mutation payloads in the API layer.
   - Add functions such as `getRoomTree()`, `getRoomDetail(id)`, `createRoom()`, `updateRoom()`, `deleteRoom()`, and `duplicateRoom()`.
4. Build the room workspace page.
   - Left panel: collapsible tree showing node name, status badge, and descendant counts.
   - Right panel: selected-room summary, breadcrumb text, and action buttons.
   - Empty states: no accessible rooms, no selected room, load/error states.
5. Add room components.
   - Tree item renderer should display duplicate-name-safe breadcrumb/path text in tooltip or detail panel.
   - Summary panel should surface `is_leaf` and delete/move restrictions from backend responses.
6. Validate.
   - `cd frontend && npx tsc --noEmit`
   - Manual navigation check: login with room permission, see nav item, open `/rooms`, select nodes, refresh deep link.

## Todo List

- [ ] Add protected `/rooms` routes
- [ ] Add permission-aware room nav item and page titles
- [ ] Define typed room API client contracts
- [ ] Build room tree shell page with list/detail split
- [ ] Render breadcrumb text for duplicate names
- [ ] Show status/count summaries from API payloads
- [ ] Keep room shell files isolated from Phase 5 device-workflow files where possible
- [ ] Pass frontend typecheck

## Success Criteria

- Users with `rooms:view` see a working “Phòng” navigation item in desktop and mobile nav.
- `/rooms` loads a room workspace page without breaking existing `/devices`, `/locations`, `/areas`, `/users`, or `/permissions` routes.
- The selected room is deep-linkable through the route, and duplicate names remain distinguishable through breadcrumb text in the UI.
- Room shell shows backend-derived status/count data and permission-aware action buttons.
- `cd frontend && npx tsc --noEmit` succeeds.

## Risk Assessment

- Medium — nav/title logic is currently hardcoded and easy to desync. Mitigation: update route registration and `getPageMeta()` in the same change set.
- Medium — stuffing room types/functions into `device-api.ts` may push the file further past maintainability limits (`frontend/src/api/device-api.ts:1-316`, `docs/code-standards.md:18-25`). Mitigation: split into a room-focused API module if growth becomes excessive, while keeping shared Axios client usage unchanged.
- Medium — tree component scope creep into full edit/create workflows. Mitigation: keep this phase to shell + selection + summary only; detailed device workflows land in Phase 5.
- Rollback: remove room routes/nav/components/API exports and rerun frontend typecheck.

## Security Considerations

- Frontend route guards are convenience only; assume backend enforces `rooms` permission and location scope. UI must still hide unavailable actions to reduce accidental forbidden requests.
- Do not infer room access client-side from locations; always trust the room API payload returned for the logged-in user.
- Avoid persisting room tree data in localStorage unless a later requirement needs it; room visibility is permission-scoped and should stay request-scoped by default.

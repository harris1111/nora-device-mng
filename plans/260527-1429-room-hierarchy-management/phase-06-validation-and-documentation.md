---
phase: 6
title: "Validation and Documentation"
status: pending
effort: "1d"
---

# Phase 6: Validation and Documentation

## Overview

Finish the room-hierarchy feature with explicit validation, regression checks, and required docs sync. This repo has no established automated test framework yet (`README.md:58-70`, `docs/project-roadmap.md:138-145`), so this phase must define practical compile checks plus targeted manual and incremental test cases. It also updates project docs because the room module changes architecture, codebase summary, and roadmap scope (`docs/codebase-summary.md:10-59`, `docs/system-architecture.md:4-29`, `docs/project-roadmap.md:50-76`).

## Requirements

- Run all required compile/generate checks after backend/frontend changes:
  - `cd backend && pnpm run db:generate`
  - `cd backend && pnpm run build`
  - `cd frontend && npx tsc --noEmit`
- Validate the backward-compatibility contract:
  - Existing main-device pages still show only non-room devices.
  - Existing device detail/edit pages still work for normal devices.
  - Existing maintenance/inventory/transfer/notification flows still work for both normal devices and room devices.
- Update docs impacted by the feature:
  - `docs/codebase-summary.md`
  - `docs/system-architecture.md`
  - `docs/project-roadmap.md`
  - `docs/code-standards.md` only if the new room patterns add durable standards.
- Keep `CLAUDE.md` and `.github/copilot-instructions.md` in sync only if either file must change for room guidance (`CLAUDE.md` sync rule).
- Define a rollback checklist that can remove room routes/UI safely if late validation fails.

## Architecture

Validation flow:
1. Regenerate Prisma client from schema before backend typecheck because generated room relations are part of the compile surface (`backend/package.json:9-12`).
2. Run backend typecheck after every route/helper change because route files are large and ESM import issues surface there first (`backend/package.json:4-12`, `docs/code-standards.md:44-58`).
3. Run frontend typecheck after route/nav/API/UI changes because room routes touch shared components and can break global navigation (`frontend/package.json:5-9`).
4. Execute a manual regression matrix spanning auth, tree CRUD, room-device workflows, maintenance/inventory notifications, and export isolation.
5. Update docs only after behavior is verified so docs reflect actual merged architecture.

## Related Code Files

### Files to modify
- `docs/codebase-summary.md` — add room module structure, routes, and room-device behavior (`docs/codebase-summary.md:10-59`, `134-160`)
- `docs/system-architecture.md` — extend data-flow and architecture sections for room tree + room-device reuse (`docs/system-architecture.md:4-29`, `31-173`)
- `docs/project-roadmap.md` — reflect room hierarchy as implemented/current work instead of stale auth-only phase descriptions (`docs/project-roadmap.md:50-76`, `122-145`)
- `docs/code-standards.md` — only if room-specific patterns become repeatable repo standards (`docs/code-standards.md:18-25`, `60-88`, `170-191`)
- `.github/copilot-instructions.md` — only if `CLAUDE.md` changes and sync is required

## Implementation Steps

1. Run compile/generation checks in order.
   - `cd backend && pnpm run db:generate`
   - Strip generated `@ts-nocheck` if Prisma still emits it, then rerun backend build if needed (`backend/src/generated/prisma/models/RoomNode.ts:4`).
   - `cd backend && pnpm run build`
   - `cd frontend && npx tsc --noEmit`
2. Execute backend regression matrix.
   - Auth loads `rooms` permission in `/api/auth/me` (`backend/src/routes/auth-routes.ts:13-20`, `65-71`).
   - `/api/rooms/tree` respects USER location assignments by room `locationId`, not by transfer fallback.
   - `/api/devices`, `/api/devices/export/excel`, and main-device bulk surfaces exclude room devices by default (`backend/src/routes/device-routes.ts:74-191`, `263-315`, `backend/src/routes/export-routes.ts:178-226`).
   - Room device detail/edit/attachments/maintenance/inventory/transfer routes work when authorized and enforce room access when `roomId != null` (`backend/src/routes/attachment-routes.ts:22-156`, `backend/src/routes/maintenance-routes.ts:22-339`, `backend/src/routes/inventory-routes.ts:22-311`, `backend/src/routes/transfer-routes.ts:25-123`).
   - Duplicate room clones allowed device scalars only and does not create attachment/history/transfer/public-summary clones.
   - `/api/public/device/:id` and all public attachment routes reject room devices.
3. Execute frontend regression matrix.
   - Nav item visibility by permission (`frontend/src/components/layout/app-layout.tsx:75-166`).
   - `/` redirects to the first allowed module, including `/rooms` for room-only users.
   - `/rooms` tree loads, selection deep-links correctly, breadcrumb disambiguates duplicate names.
   - Room-device create/detail/edit stays inside room routes.
   - Main `/devices` list, bulk actions, and export page remain normal-device only (`frontend/src/pages/device-list-page.tsx:154-169`, `215-239`, `371-513`; `frontend/src/pages/excel-export-page.tsx:15-24`, `93-194`).
4. Update docs after verification.
   - Add room models/routes/flows to `codebase-summary.md`.
   - Add room tree and room-device data-flow diagrams to `system-architecture.md`.
   - Update roadmap status and success metrics to reflect implemented room hierarchy scope.
   - Add any stable room-specific coding conventions only if they are now repo-wide guidance.
5. Define rollback instructions.
   - Backend rollback: remove room schema fields/routes/helpers, regenerate Prisma client, rebuild backend.
   - Frontend rollback: remove room routes/nav/components/API calls, rerun frontend typecheck.
   - Data rollback: if schema is already pushed, document how to clear `Device.roomId` and delete `RoomNode` rows before reverting code to avoid orphaned references.

## Todo List

- [ ] Run Prisma generate + backend/frontend typechecks
- [ ] Verify auth permission payload includes `rooms`
- [ ] Validate room RBAC, tree CRUD, and delete/move invariants
- [ ] Validate room-device create/detail/edit and hidden-main-list behavior
- [ ] Validate duplicate clone exclusions
- [ ] Validate maintenance/inventory/transfer/notification regressions
- [ ] Update codebase summary, architecture, and roadmap docs
- [ ] Document rollback steps

## Success Criteria

- All required commands complete successfully:
  - `cd backend && pnpm run db:generate`
  - `cd backend && pnpm run build`
  - `cd frontend && npx tsc --noEmit`
- Main-device regressions are absent: list, detail, edit, export, and filters still behave correctly for non-room devices.
- Room-specific regressions are absent: room tree, room actions, room-device flows, and duplicate all match locked scope.
- Docs reflect the implemented room module accurately.
- Rollback steps are written and verified conceptually against current file ownership/dependencies.

## Risk Assessment

- High — lack of automated tests means hidden regressions can survive compile checks. Mitigation: use a strict manual matrix covering both legacy and new flows; do not sign off on “smoke only”.
- Medium — docs can drift from final implementation if updated too early. Mitigation: document only after the compile and manual matrix are green.
- Medium — schema rollback after `db push` is harder than code rollback because this repo does not use migration files (`backend/package.json:9-12`, `docs/system-architecture.md:175-199`). Mitigation: document data cleanup steps explicitly before code revert.
- Rollback: follow the written phase rollback sequence and rerun both typechecks after every revert step.

## Security Considerations

- Regression testing must include unauthorized USER access attempts for inaccessible locations/rooms/devices; security regressions are not optional checks.
- Doc updates must not include secrets, internal URLs, or environment-specific credentials.
- If rollback requires touching live room data, treat it as potentially destructive and require explicit operator review before execution.

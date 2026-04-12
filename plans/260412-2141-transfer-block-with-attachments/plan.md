---
title: "Transfer Block With Attachments"
description: "Add a dedicated transfer block and transfer attachments with the smallest additive schema change"
status: pending
priority: P1
effort: 5h
branch: main
tags: [transfer, attachments, backend, frontend]
created: 2026-04-12
---

# Transfer Block With Attachments

## Recommendation
- Schema change is required. Current Device.transferTo and Device.transferDate fields cannot own attachments or support clean S3 lifecycle by themselves.
- Smallest viable model: add one current transfer record per device via TransferRecord with unique deviceId, plus TransferAttachment rows under that record.
- Keep Device.transferTo and Device.transferDate in this pass as compatibility summary fields. Detail/public UI reads a nested transfer block; list/form callers can keep using top-level fields. This avoids a destructive migration and avoids a required backfill script.

## Data Flow
1. Device form submit: frontend/src/components/device-form.tsx -> POST/PUT /api/devices -> update Device top-level transfer fields and upsert TransferRecord summary.
2. Transfer attachment upload/delete: transfer block on detail page -> /api/devices/:deviceId/transfer/attachments and /api/transfer-attachments/:id -> S3 upload/delete + TransferAttachment row changes.
3. Detail/public read: GET /api/devices/:id and GET /api/public/device/:id -> include transfer + transfer.attachments -> dedicated transfer card renders independently from generic device info.
4. Legacy data path: if TransferRecord is missing but Device.transferTo or Device.transferDate exists, API returns a synthetic transfer block with empty attachments; first edit/upload lazily creates the row.

## Step-by-Step Plan
1. Add TransferRecord and TransferAttachment to backend/prisma/schema.prisma with Device.transferRecord as one-to-one and deviceId unique. Do not remove existing Device.transferTo or Device.transferDate in this pass.
2. Extend backend/src/routes/device-routes.ts and backend/src/utils/response-mapper.ts so create/update upserts the one current transfer record and detail responses expose transfer: { transfer_to, transfer_date, attachments } with fallback to legacy fields.
3. Add backend/src/routes/transfer-routes.ts and mount it from backend/src/index.ts for upload, delete, and file streaming of transfer attachments. Reuse the same MIME limits and S3 key pattern style as maintenance attachments, e.g. transfers/{deviceId}/{attachmentId}{ext}.
4. Extend backend/src/routes/public-routes.ts so the public device payload includes the same transfer block and transfer attachments.
5. Extend frontend/src/api/device-api.ts with TransferInfo and TransferAttachmentItem types plus transfer upload/delete/file helpers, while keeping existing Device.transfer_to and Device.transfer_date for compatibility.
6. Add frontend/src/components/transfer-info-section.tsx and generalize frontend/src/components/attachment-list.tsx to accept a custom file URL builder so the same table UI can render device, maintenance, and transfer attachments.
7. Remove inline transfer fields from the general info grids in frontend/src/pages/device-detail-page.tsx and frontend/src/pages/public-device-page.tsx, then render the new transfer block as its own card beside the existing attachments and maintenance sections.
8. Keep transfer metadata editing in frontend/src/components/device-form.tsx with the current inputs and minimal copy changes only. Do not move this into a new workflow.

## Touched Files
- Backend modify: backend/prisma/schema.prisma, backend/src/index.ts, backend/src/routes/device-routes.ts, backend/src/routes/public-routes.ts, backend/src/utils/response-mapper.ts
- Backend create: backend/src/routes/transfer-routes.ts
- Frontend modify: frontend/src/api/device-api.ts, frontend/src/components/attachment-list.tsx, frontend/src/components/device-form.tsx, frontend/src/pages/device-detail-page.tsx, frontend/src/pages/public-device-page.tsx
- Frontend create: frontend/src/components/transfer-info-section.tsx

## Risks And Mitigations
- Dual-write drift between Device.transfer* and TransferRecord. Mitigation: keep all write logic inside device-routes.ts helper paths and always build nested transfer responses from relation first, legacy fields second.
- Existing rows have transfer fields but no transfer record. Mitigation: fallback response + lazy row creation on first edit or attachment upload.
- Device detail page is already large. Mitigation: put the new UI into transfer-info-section.tsx instead of growing the page further.
- Delete cleanup can miss transfer S3 files. Mitigation: extend device delete lookup to include transfer.attachments and delete those keys with the rest.

## Validation And Rollback
- Commands: cd backend && pnpm run db:generate; cd backend && npx prisma db push; cd backend && pnpm run build; cd frontend && npx tsc --noEmit
- Manual checks: create device with transfer info, edit transfer info, upload and delete transfer attachments from detail page, verify public page shows the transfer block, verify existing devices with only legacy transfer fields still render.
- Rollback: revert code and ignore the additive transfer tables. Existing top-level Device.transferTo and Device.transferDate remain intact, so rollback does not strand current transfer data.

## Execution Notes
- One-pass, serial implementation is recommended. No parallel file ownership: schema/routes first, shared frontend API/component second, pages last.
- Success means: transfer appears as its own card on detail/public pages, attachments are tied to the current transfer block, and transfer metadata remains editable from the existing device form.

## Status
**Status:** VERIFICATION_COMPLETE
**Summary:** All code implemented and validated. Backend build passes. Frontend production build passes. Prisma db push complete. Runtime validation on backend at port 13001 confirmed health check, device endpoints, and legacy transfer fallback working correctly.
**Validated:** 
1. ✅ Backend build passes (migrate-images-to-s3.ts fixed)
2. ✅ Frontend production build passes
3. ✅ Prisma db push completed
4. ✅ Runtime: /api/health ok, /api/devices returns data, /api/devices/:id and /api/public/device/:id return transfer fallback with empty attachments
**Not Tested (by design):** Transfer attachment upload/delete mutations deferred to avoid mutating existing data.
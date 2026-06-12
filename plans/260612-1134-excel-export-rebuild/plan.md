# Excel Export Rebuild Plan

## Context
- Brief: `brief copy.txt`
- Existing backend: `backend/src/routes/export-routes.ts`
- Existing frontend: `frontend/src/pages/excel-export-page.tsx`
- API helper: `frontend/src/api/device-api.ts`

## Status
- Phase 1 research: complete
- Phase 2 backend: pending
- Phase 3 frontend: pending
- Phase 4 verification/docs: pending

## Requirements
- Keep current device Excel export working.
- Add explicit export type selection, with device list as the first supported type.
- Let users choose export columns.
- Keep filters and allow exporting all matching data, not only visible page data.
- Keep selected-row export for explicit subsets.
- Preserve room exclusion and USER location scope.
- Generated workbook keeps Excel autofilter.

## Implementation
1. Move export labels, column definitions, type metadata, and workbook building out of the route file.
2. Add `/api/devices/export/options` for report types and columns.
3. Accept `export_type` and `columns` in existing Excel GET/POST endpoints.
4. Redesign `/export` page into type, filters, column picker, preview, and action areas.
5. Keep `exportDevicesExcelFiltered` backward-compatible for the device list page.
6. Run backend build and frontend build/type checks.
7. Update roadmap/changelog for the feature.

## Risks
- Dynamic column keys must be validated server-side.
- QR generation should run only when QR column selected.
- Existing device list export must not regress.
- Query filters use names in UI but IDs in API for location/area.

## Unresolved Questions
- None.

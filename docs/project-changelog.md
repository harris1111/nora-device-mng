# Project Changelog — Nora Device Manager

## June 12, 2026

### Excel Export Preview Fix
- Fixed export preview showing only 100 devices by adding a full filtered preview endpoint for the Excel workspace.
- Aligned selected-row Excel export with full filtered export so selecting more than 500 devices does not fail solely because of ID count.

### Excel Export Rebuild
- Added export metadata endpoint for Excel report types and selectable columns.
- Reworked device workbook generation around validated column definitions.
- Added export page workflow for report type, filters, column picker, preview table, selected-row export, and full filtered export.
- Preserved room-device exclusion and USER location scoping in export queries.

### Validation
- Backend TypeScript build passed.
- Frontend TypeScript check passed.
- Frontend production build passed.

## Unresolved Questions
- None.

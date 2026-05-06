---
name: brief1-warranty-and-transfer-unit-filter
status: in_progress
created: 2026-05-06
branch: main
---

# Brief 1 — Warranty Duration + Transfer-Unit Filter

Source: `Brief 1.txt`

## Tasks

1. **Warranty duration on Device** — nullable two-field representation
   - DB: `warranty_value Int?`, `warranty_unit String?` (`'month'` or `'year'`)
   - API: snake_case `warranty_value`, `warranty_unit`
   - Form: number input + unit select; allows leaving blank
   - Detail page: render in `infoFields` as `"X tháng"` or `"X năm"`

2. **Filter device list by transfer unit** (`đơn vị chuyển giao`)
   - Backed by `device.owned_by` (string — already shown in list-row "Chuyển giao" col)
   - Add `transferUnit` to `DeviceFilters`
   - UI: distinct `owned_by` values aggregated client-side into a dropdown in advanced filter row
   - Filter logic: `device.owned_by === filters.transferUnit`

## Rationale (KISS / YAGNI)

- Warranty stored as 2 columns to preserve user intent (1 year ≠ 12 months semantically for UX).
- Transfer-unit filter uses existing `owned_by` field, no schema change. Distinct values harvested from current page's devices to avoid an extra endpoint.
- All filtering kept client-side (matches existing `useDeviceFilter` pattern).

## Files

### Backend
- `backend/prisma/schema.prisma` — add 2 nullable cols on `Device`
- `backend/src/utils/response-mapper.ts` — emit `warranty_value` / `warranty_unit`
- `backend/src/routes/device-routes.ts` — accept + persist on POST/PUT, validate unit ∈ {month, year}, value > 0

### Frontend
- `frontend/src/api/device-api.ts` — extend `Device` type
- `frontend/src/components/device/device-form.tsx` — warranty input pair
- `frontend/src/pages/device-detail-page.tsx` — warranty in `infoFields`
- `frontend/src/components/device-filter-bar.tsx` — `transferUnit` filter + `useDeviceFilter` update
- `frontend/src/pages/device-list-page.tsx` — pass devices to filter bar for distinct owners

## Validation

- Backend tsc, frontend tsc
- Docker build
- Manual smoke: create device with warranty, edit warranty, view detail, filter list by transfer unit

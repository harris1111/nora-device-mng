# Phase 4: Device Types & Status

## Context Links
- Phase 1 (dependency): [phase-01-postgres-prisma-migration.md](phase-01-postgres-prisma-migration.md)
- Device form: `frontend/src/components/device-form.jsx`
- Device list: `frontend/src/pages/device-list-page.jsx`
- Device card: `frontend/src/components/device-card.jsx`
- Device list row: `frontend/src/components/device-list-row.jsx`
- Device detail: `frontend/src/pages/device-detail-page.jsx`
- Device routes: `backend/src/routes/device-routes.js`
- Response mapper: `backend/src/utils/response-mapper.js` (created in Phase 1)

## Overview
- **Priority:** P2
- **Status:** Pending (blocked by Phase 1)
- **Effort:** 5h
- **Branch:** `feat/device-types-status`

Add device classification (Tai san / Cong cu dung cu) with type-specific statuses and conditional fields. Each type has its own status enum and lifecycle fields.

## Key Insights
- Two device types: `tai_san` (Tai san) and `cong_cu_dung_cu` (Cong cu dung cu / CCDC)
- Status depends on type — NOT a single enum:
  - Tai san: `active`, `under_repair`, `decommissioned`
  - CCDC: `active`, `disposed`, `lost`
- `disposal_date` and `loss_date` are CCDC-only fields
- Setting `disposal_date` → auto-set status to `disposed`
- Setting `loss_date` → auto-set status to `lost`
- Default type: `tai_san`, default status: `active`

## Requirements

### Functional
- `type` field on devices: `tai_san` (default) or `cong_cu_dung_cu`
- `status` field on devices: depends on type
- `disposal_date` and `loss_date` on devices (nullable, CCDC only)
- Setting disposal_date auto-sets status to `disposed`
- Setting loss_date auto-sets status to `lost`
- Device form: type selector with conditional status/date fields
- Device list: type and status filter dropdowns
- Status badge on device cards/rows/detail

### Non-Functional
- Existing devices default to `tai_san` / `active` after migration
- Type cannot be changed after creation (prevents status inconsistency)

## Architecture

### Prisma Schema Changes

```prisma
model Device {
  // ... existing fields ...
  type         String   @default("tai_san")
  status       String   @default("active")
  disposalDate DateTime? @map("disposal_date")
  lossDate     DateTime? @map("loss_date")
  // ... relations ...
}
```

Using String (not enum) for type/status — simpler, no migration needed for new values.

### Status Rules (Backend Validation)

```js
// backend/src/utils/device-status-rules.js
export const DEVICE_TYPES = ['tai_san', 'cong_cu_dung_cu'];

export const STATUS_BY_TYPE = {
  tai_san: ['active', 'under_repair', 'decommissioned'],
  cong_cu_dung_cu: ['active', 'disposed', 'lost'],
};

export const TYPE_LABELS = {
  tai_san: 'Tai san',
  cong_cu_dung_cu: 'Cong cu dung cu',
};

export const STATUS_LABELS = {
  active: 'Dang su dung',
  under_repair: 'Dang sua chua',
  decommissioned: 'Da thanh ly',
  disposed: 'Da xu ly',
  lost: 'Da mat',
};

export function validateTypeStatus(type, status) {
  if (!DEVICE_TYPES.includes(type)) return `Invalid type: ${type}`;
  if (!STATUS_BY_TYPE[type].includes(status)) return `Invalid status "${status}" for type "${type}"`;
  return null;
}

export function applyDateStatusRules(type, data) {
  if (type !== 'cong_cu_dung_cu') {
    data.disposalDate = null;
    data.lossDate = null;
    return data;
  }
  if (data.disposalDate) data.status = 'disposed';
  if (data.lossDate) data.status = 'lost';
  return data;
}
```

### API Changes
- `POST /api/devices` — accept `type` (required), `status` (optional, default `active`), `disposal_date`, `loss_date`
- `PUT /api/devices/:id` — accept `status`, `disposal_date`, `loss_date` (type immutable)
- `GET /api/devices` — accept query params `?type=tai_san&status=active` for filtering
- Response includes `type`, `status`, `disposal_date`, `loss_date`

## Related Code Files

### Files to Create
- `backend/src/utils/device-status-rules.js` — type/status enums, validation, auto-status logic
- `frontend/src/utils/device-constants.js` — type/status labels and mappings for UI
- `frontend/src/components/device-type-selector.jsx` — type radio/select (create only)
- `frontend/src/components/device-status-badge.jsx` — colored status badge component
- `frontend/src/components/device-list-filters.jsx` — type + status filter bar

### Files to Modify
- `backend/prisma/schema.prisma` — add type, status, disposalDate, lossDate to Device
- `backend/src/routes/device-routes.js` — validate type/status on create/update, add query filters
- `backend/src/utils/response-mapper.js` — include type, status, dates in response
- `frontend/src/components/device-form.jsx` — add type selector, conditional status/date fields
- `frontend/src/pages/device-list-page.jsx` — integrate filter bar, pass filter params
- `frontend/src/components/device-card.jsx` — show status badge
- `frontend/src/components/device-list-row.jsx` — show type + status columns
- `frontend/src/pages/device-detail-page.jsx` — show type label + status badge + CCDC dates
- `frontend/src/api/device-api.js` — add filter params to getDevices()

## Implementation Steps

### 1. Update Prisma schema + migrate
Add fields to Device model, run:
```bash
npx prisma migrate dev --name add-device-type-status
```
Existing devices get `type='tai_san'`, `status='active'` via defaults.

### 2. Create status rules utility
`backend/src/utils/device-status-rules.js` — exports validation and auto-status logic.

### 3. Update device-routes.js

**Create endpoint changes:**
```js
const { type = 'tai_san', status = 'active', disposal_date, loss_date } = req.body;
const err = validateTypeStatus(type, status);
if (err) return res.status(400).json({ error: err });
let data = { type, status, disposalDate: disposal_date ? new Date(disposal_date) : null, lossDate: loss_date ? new Date(loss_date) : null };
data = applyDateStatusRules(type, data);
```

**Update endpoint changes:**
- Reject `type` changes: `if (req.body.type && req.body.type !== existing.type) return 400`
- Validate status against existing type
- Apply date-status auto-rules

**List endpoint changes:**
```js
const { type, status } = req.query;
const where = {};
if (type) where.type = type;
if (status) where.status = status;
const devices = await prisma.device.findMany({ where, include: { location: true }, orderBy: { createdAt: 'desc' } });
```

### 4. Update response mapper
Add to `mapDevice()`:
```js
type: d.type,
status: d.status,
disposal_date: d.disposalDate?.toISOString() || null,
loss_date: d.lossDate?.toISOString() || null,
```

### 5. Create frontend constants
```js
// frontend/src/utils/device-constants.js
export const DEVICE_TYPES = [
  { value: 'tai_san', label: 'Tai san' },
  { value: 'cong_cu_dung_cu', label: 'Cong cu dung cu' },
];

export const STATUS_BY_TYPE = {
  tai_san: [
    { value: 'active', label: 'Dang su dung', color: 'green' },
    { value: 'under_repair', label: 'Dang sua chua', color: 'amber' },
    { value: 'decommissioned', label: 'Da thanh ly', color: 'red' },
  ],
  cong_cu_dung_cu: [
    { value: 'active', label: 'Dang su dung', color: 'green' },
    { value: 'disposed', label: 'Da xu ly', color: 'slate' },
    { value: 'lost', label: 'Da mat', color: 'red' },
  ],
};
```

### 6. Create device-type-selector component
Radio buttons or segmented control. Disabled when editing (type immutable).

### 7. Create device-status-badge component
Small pill with color based on status. Reusable across card, row, detail.

### 8. Update device-form.jsx
- Add type selector (visible on create, disabled on edit)
- Show status dropdown filtered by selected type
- Show `disposal_date` and `loss_date` date pickers when type is `cong_cu_dung_cu`
- Include new fields in FormData submission

### 9. Create device-list-filters component
Dropdown filters for type + status. Pass as query params to `getDevices()`.

### 10. Update device-list-page.jsx
- Add `<DeviceListFilters>` above list
- State: `filterType`, `filterStatus`
- Filter locally (devices already fetched) or pass to API

### 11. Update device-card.jsx + device-list-row.jsx
Show status badge. Optionally show type label.

### 12. Update device-detail-page.jsx
- Show type label near store_id badge
- Show status badge
- If CCDC: show disposal_date / loss_date in info fields section

## Todo List

- [ ] Add type, status, disposalDate, lossDate to Prisma schema
- [ ] Run migration
- [ ] Create `device-status-rules.js` (backend)
- [ ] Update `device-routes.js` — create/update validation, list filtering
- [ ] Update `response-mapper.js` — include new fields
- [ ] Create `device-constants.js` (frontend)
- [ ] Create `device-type-selector.jsx`
- [ ] Create `device-status-badge.jsx`
- [ ] Create `device-list-filters.jsx`
- [ ] Update `device-form.jsx` — type, status, conditional CCDC fields
- [ ] Update `device-list-page.jsx` — integrate filters
- [ ] Update `device-card.jsx` — status badge
- [ ] Update `device-list-row.jsx` — type + status columns
- [ ] Update `device-detail-page.jsx` — type/status/dates display
- [ ] Update `device-api.js` — filter params
- [ ] Test: create tai_san with valid/invalid status
- [ ] Test: create CCDC, set disposal_date, verify auto-status
- [ ] Test: attempt type change on update → rejected

## Success Criteria
- Create device with type `cong_cu_dung_cu` → status options are CCDC-specific
- Set `disposal_date` on CCDC device → status auto-changes to `disposed`
- Attempt to change type on existing device → 400 error
- Device list filters by type and status correctly
- Status badge appears on cards, rows, and detail page
- Existing devices show as `tai_san` / `active` after migration

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Type/status mismatch in existing data | None | N/A | All existing default to tai_san/active |
| Type change allowed by accident | Low | Med | Backend validation rejects type changes on update |
| Date parsing issues (timezone) | Med | Low | Store as UTC DateTime, display in local timezone |
| Too many filter combos confuse UI | Low | Low | Only 2 filters (type + status), simple dropdowns |

## Security Considerations
- Type and status validated against allowlists — no arbitrary values
- Date fields parsed with `new Date()` — invalid dates return NaN, caught by Prisma validation

# Phase 5: Simplify Transfers

## Context Links
- Phase 1 (dependency): [phase-01-postgres-prisma-migration.md](phase-01-postgres-prisma-migration.md)
- Current transfer routes: `backend/src/routes/device-routes.js` lines 138-168
- Transfer form: `frontend/src/components/transfer-form.jsx`
- Transfer history: `frontend/src/components/transfer-history.jsx`
- Device detail (transfer section): `frontend/src/pages/device-detail-page.jsx` lines 191-208
- Device API (transfer fns): `frontend/src/api/device-api.js` lines 16-17

## Overview
- **Priority:** P2
- **Status:** Pending (blocked by Phase 1)
- **Effort:** 3h
- **Branch:** `feat/simplify-transfers`

Replace the full transfer history system with simple `transfer_to` + `transfer_date` fields on the devices table. Drop the `device_transfers` table entirely.

## Key Insights
- Current system tracks full history with from/to/by/note/date per transfer — overkill for actual usage
- Simplified model: device has optional `transfer_to` (text) and `transfer_date` (timestamp)
- `owned_by` field remains — it represents current owner/department
- `transfer_to` represents the destination of a pending/completed transfer
- Transfer is set via the normal device edit form — no separate transfer flow

## Requirements

### Functional
- Add `transfer_to` (String, optional) and `transfer_date` (DateTime, optional) to devices
- Drop `device_transfers` table and `DeviceTransfer` model
- Remove transfer API endpoints (`POST /:id/transfer`, `GET /:id/transfers`)
- Remove transfer-form and transfer-history frontend components
- Show transfer info on device detail page (simple display)
- Allow setting transfer_to/transfer_date on device edit form

### Non-Functional
- Existing transfer history data is intentionally lost (confirmed with user)
- Migration is destructive — no rollback for transfer data

## Architecture

### Prisma Schema Changes

**Add to Device model:**
```prisma
model Device {
  // ... existing fields ...
  transferTo   String?   @map("transfer_to")
  transferDate DateTime? @map("transfer_date")
  // Remove: transfers DeviceTransfer[]
}
```

**Delete DeviceTransfer model entirely.**

### API Changes
- `POST /api/devices` — accept `transfer_to`, `transfer_date`
- `PUT /api/devices/:id` — accept `transfer_to`, `transfer_date`
- `GET /api/devices`, `GET /api/devices/:id` — include transfer fields in response
- **Remove:** `POST /api/devices/:id/transfer`
- **Remove:** `GET /api/devices/:id/transfers`

## Related Code Files

### Files to Delete
- `frontend/src/components/transfer-form.jsx`
- `frontend/src/components/transfer-history.jsx`

### Files to Modify
- `backend/prisma/schema.prisma` — add transfer fields to Device, remove DeviceTransfer model
- `backend/src/routes/device-routes.js` — remove transfer endpoints, add transfer fields to create/update
- `backend/src/utils/response-mapper.js` — include transfer_to, transfer_date
- `frontend/src/api/device-api.js` — remove `transferDevice()`, `getDeviceTransfers()`
- `frontend/src/components/device-form.jsx` — add transfer_to + transfer_date fields
- `frontend/src/pages/device-detail-page.jsx` — remove TransferForm/TransferHistory imports, show simple transfer info

## Implementation Steps

### 1. Update Prisma schema
- Add `transferTo` and `transferDate` to Device model
- Remove entire `DeviceTransfer` model
- Remove `transfers` relation from Device

### 2. Run migration
```bash
npx prisma migrate dev --name simplify-transfers
```
This will DROP the `device_transfers` table.

### 3. Update device-routes.js

**Remove these endpoints:**
- `POST /:id/transfer` (lines 138-161)
- `GET /:id/transfers` (lines 163-168)

**Remove these imports:**
- `createTransfer`, `getTransfersByDeviceId` (no longer exist after Phase 1 replaced database.js)

**Update create/update handlers:**
```js
// In POST / and PUT /:id
const { transfer_to, transfer_date, ...otherFields } = req.body;
// Include in prisma create/update data:
transferTo: transfer_to?.trim() || null,
transferDate: transfer_date ? new Date(transfer_date) : null,
```

### 4. Update response-mapper.js
```js
transfer_to: d.transferTo || null,
transfer_date: d.transferDate?.toISOString() || null,
```

### 5. Update device-api.js
Remove:
```js
export const transferDevice = ...
export const getDeviceTransfers = ...
```

### 6. Update device-form.jsx
Add two fields after the description/notes section:
- `transfer_to` — text input: "Chuyển giao cho"
- `transfer_date` — date input: "Ngày chuyển giao"

Include in FormData on submit.

### 7. Update device-detail-page.jsx
- Remove imports: `TransferForm`, `TransferHistory`
- Remove `transferRefresh` state and `handleTransferred` handler
- Remove entire transfer section (lines 191-208)
- Add transfer info to `infoFields` array:
```js
{ label: 'Chuyển giao cho', value: device.transfer_to },
{ label: 'Ngày chuyển giao', value: device.transfer_date ? new Date(device.transfer_date).toLocaleDateString('vi-VN') : null },
```

### 8. Delete transfer components
- Delete `frontend/src/components/transfer-form.jsx`
- Delete `frontend/src/components/transfer-history.jsx`

### 9. Verify no remaining references
Grep for `transfer-form`, `transfer-history`, `transferDevice`, `getDeviceTransfers`, `DeviceTransfer` across codebase.

## Todo List

- [ ] Update Prisma schema: add transfer fields, remove DeviceTransfer
- [ ] Run migration (drops device_transfers table)
- [ ] Update `device-routes.js` — remove transfer endpoints, add fields to create/update
- [ ] Update `response-mapper.js` — include transfer fields
- [ ] Update `device-api.js` — remove transfer functions
- [ ] Update `device-form.jsx` — add transfer_to + transfer_date inputs
- [ ] Update `device-detail-page.jsx` — remove transfer section, add simple info
- [ ] Delete `transfer-form.jsx`
- [ ] Delete `transfer-history.jsx`
- [ ] Grep for stale references to transfers
- [ ] Test: create device with transfer info, view on detail page
- [ ] Test: edit device transfer fields

## Success Criteria
- No `device_transfers` table in database
- No transfer-related endpoints in API
- No `transfer-form.jsx` or `transfer-history.jsx` in codebase
- Device form allows setting transfer_to + transfer_date
- Device detail page shows transfer info inline
- Device list API response includes transfer fields

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Data loss (transfer history) | Certain | Low | Confirmed intentional by user |
| Missing transfer references cause runtime errors | Med | Med | Grep sweep after deletion |
| Users confused by simplified transfer UX | Low | Low | Transfer fields are self-explanatory |

## Security Considerations
- `transfer_to` is free text — sanitized via `.trim()`, no special validation needed
- `transfer_date` parsed as Date — invalid values caught by Prisma

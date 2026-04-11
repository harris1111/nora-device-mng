# Phase 5: Device Detail Page + Transfer UI

## Context
- [device-detail-page.jsx](../../frontend/src/pages/device-detail-page.jsx) — 157 lines
- Depends on: Phase 3
- Parallel with: Phase 4 (no file overlap)

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 2h

## Key Insights
- Detail page at 157 lines — adding inline transfer + history will exceed 200
- Strategy: extract `transfer-form.jsx` and `transfer-history.jsx` as separate components
- Transfer form is a simple modal/inline form: to_owner, note, transferred_by, submit
- History is a timeline list ordered newest-first

## Requirements

### Device detail page additions
1. Show managed_by/owned_by badges near store_id/location badges
2. Show serial_number, model, manufacturer, description in an info grid
3. "Chuyển giao" (Transfer) button opens transfer form
4. Transfer history timeline below device info

### Transfer form component
- Fields: "Chuyển cho" (to_owner, required), "Người thực hiện" (transferred_by), "Ghi chú" (note)
- Submit calls `transferDevice(id, data)`
- On success: refresh device data + transfer history, close form

### Transfer history component
- List of transfers: from -> to, transferred_by, note, date
- Timeline style (vertical line with dots)
- Empty state: "Chưa có lịch sử chuyển giao"

## Related Code Files
- **Modify:** `frontend/src/pages/device-detail-page.jsx`
- **Create:** `frontend/src/components/transfer-form.jsx`
- **Create:** `frontend/src/components/transfer-history.jsx`

## Implementation Steps

### 1. Create `transfer-form.jsx` (~80 lines)
```
Props: { deviceId, currentOwner, onTransferred, onCancel }
State: toOwner, transferredBy, note, submitting, error
Submit: POST transferDevice(deviceId, { to_owner, transferred_by, note })
On success: call onTransferred()
```
- 3 input fields + submit/cancel buttons
- Inline card style (not a modal — simpler)

### 2. Create `transfer-history.jsx` (~60 lines)
```
Props: { transfers }
Render: vertical timeline of transfers
Each entry: "{from_owner} → {to_owner}" | transferred_by | note | date
Empty state message if transfers.length === 0
```

### 3. Update `device-detail-page.jsx`
- Import new components + `getDeviceTransfers`, `transferDevice` from api
- Add state: `transfers`, `showTransferForm`
- Fetch transfers in useEffect alongside device data
- Add info section after device name showing:
  - managed_by, owned_by (as labeled badges/pills)
  - serial_number, model, manufacturer (as key-value pairs)
  - description (as paragraph if non-empty)
- Add "Chuyển giao" button next to edit/delete buttons
- Render `<TransferForm>` when showTransferForm is true
- Render `<TransferHistory>` below QR section
- On successful transfer: re-fetch device + transfers

### 4. Line count management
Detail page should stay ~120 lines after extracting transfer components. The two new components add ~140 lines total.

## Todo List
- [ ] Create transfer-form.jsx with to_owner, transferred_by, note fields
- [ ] Create transfer-history.jsx with timeline rendering
- [ ] Add ownership/detail info section to device-detail-page
- [ ] Add "Chuyển giao" button to action bar (desktop + mobile)
- [ ] Add transfer form toggle + render
- [ ] Add transfers fetch + transfer-history render
- [ ] Verify all files under 200 lines

## Success Criteria
- Detail page shows managed_by, owned_by, serial_number, model, manufacturer, description
- "Chuyển giao" button opens inline form
- Submitting transfer updates owned_by and adds history entry
- History timeline renders correctly, newest first
- Empty history shows placeholder text
- All 3 files under 200 lines

## Security Considerations
- Transfer form trims all inputs before sending
- No client-side data mutation — always re-fetch from server after transfer

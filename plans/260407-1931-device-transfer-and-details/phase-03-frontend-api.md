# Phase 3: Frontend API Layer

## Context
- [device-api.js](../../frontend/src/api/device-api.js) — existing API client (19 lines)
- Depends on: Phase 2

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 0.5h

## Implementation Steps

### Add two new API functions to `device-api.js`

```js
// Transfer API
export const transferDevice = (id, data) =>
  api.post(`/devices/${id}/transfer`, data).then(r => r.data);

export const getDeviceTransfers = (id) =>
  api.get(`/devices/${id}/transfers`).then(r => r.data);
```

No changes needed for device CRUD — `createDevice` and `updateDevice` already use FormData, so new fields are appended by the form component.

## Related Code Files
- **Modify:** `frontend/src/api/device-api.js`

## Todo List
- [ ] Add transferDevice() function
- [ ] Add getDeviceTransfers() function

## Success Criteria
- Both functions exported and callable
- File stays under 30 lines

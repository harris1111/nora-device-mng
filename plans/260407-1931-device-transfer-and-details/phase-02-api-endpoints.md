# Phase 2: API Endpoints

## Context
- [device-routes.js](../../backend/src/routes/device-routes.js) — existing device CRUD routes
- Depends on: Phase 1 (database functions)

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 1.5h

## Key Insights
- Existing POST/PUT already use `req.body` for fields — just add new fields to destructuring
- Transfer endpoint is a new POST sub-resource route: `/api/devices/:id/transfer`
- Transfer history is a new GET: `/api/devices/:id/transfers`
- Route file is 143 lines currently — adding ~40 lines for transfer routes keeps it under 200

## Requirements

### Modified Endpoints
- **POST /api/devices** — accept `managed_by`, `owned_by`, `serial_number`, `model`, `manufacturer`, `description` in body
- **PUT /api/devices/:id** — same additional fields

### New Endpoints
- **POST /api/devices/:id/transfer** — body: `{ to_owner, note, transferred_by }`
  - Validates device exists, `to_owner` not empty
  - Calls `createTransfer()` (transaction: insert record + update owned_by)
  - Returns 201 with transfer record
- **GET /api/devices/:id/transfers** — returns array of transfer records, newest first

## Related Code Files
- **Modify:** `backend/src/routes/device-routes.js`

## Implementation Steps

### 1. Update imports
Add `createTransfer`, `getTransfersByDeviceId` to imports from `../database.js`.

### 2. Update POST /api/devices
Add to destructuring: `managed_by, owned_by, serial_number, model, manufacturer, description`
Pass to `createDevice()`:
```js
managedBy: (managed_by || '').trim(),
ownedBy: (owned_by || '').trim(),
serialNumber: (serial_number || '').trim(),
model: (model || '').trim(),
manufacturer: (manufacturer || '').trim(),
description: (description || '').trim(),
```

### 3. Update PUT /api/devices/:id
Same field additions as POST.

### 4. Add transfer endpoints
```js
// POST /api/devices/:id/transfer
router.post('/:id/transfer', (req, res) => {
  try {
    const device = getDeviceById(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    
    const { to_owner, note, transferred_by } = req.body;
    if (!to_owner?.trim()) return res.status(400).json({ error: 'to_owner is required' });
    
    const id = uuidv4();
    createTransfer({
      id,
      deviceId: device.id,
      fromOwner: device.owned_by || '',
      toOwner: to_owner.trim(),
      transferredBy: (transferred_by || '').trim(),
      note: (note || '').trim(),
    });
    
    res.status(201).json({ id, device_id: device.id, from_owner: device.owned_by || '', to_owner: to_owner.trim(), transferred_by: (transferred_by || '').trim(), note: (note || '').trim() });
  } catch (err) {
    console.error('Transfer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/devices/:id/transfers
router.get('/:id/transfers', (req, res) => {
  const device = getDeviceById(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  res.json(getTransfersByDeviceId(req.params.id));
});
```

**IMPORTANT:** Place these BEFORE the `/:id/image` and `/:id/qrcode` routes (or after — Express matches by registration order and these paths don't conflict). Place after `/:id` GET for clarity.

## Todo List
- [ ] Update imports from database.js
- [ ] Add new fields to POST /api/devices handler
- [ ] Add new fields to PUT /api/devices/:id handler
- [ ] Add POST /api/devices/:id/transfer endpoint
- [ ] Add GET /api/devices/:id/transfers endpoint
- [ ] Verify route ordering doesn't conflict

## Success Criteria
- `curl POST /api/devices` with new fields creates device with all fields persisted
- `curl POST /api/devices/:id/transfer` returns 201, updates owned_by, creates transfer record
- `curl GET /api/devices/:id/transfers` returns ordered history
- 400 on missing to_owner, 404 on bad device id

## Security Considerations
- All inputs trimmed before storage
- Parameterized queries (inherited from database.js pattern)
- No auth required (matches existing app — no auth system)

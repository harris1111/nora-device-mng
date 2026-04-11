# Phase 4: Device Form Update

## Context
- [device-form.jsx](../../frontend/src/components/device-form.jsx) — 182 lines currently
- Depends on: Phase 3
- Parallel with: Phase 5 (no file overlap)

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 1h

## Key Insights
- Form already at 182 lines; adding 6 fields will push it over 200
- Strategy: group new fields logically. If file exceeds ~220 lines, extract image upload section into `device-image-upload.jsx`
- New fields use same input pattern as existing store_id/name fields
- managed_by, owned_by are free-text (not dropdowns) — KISS, no department table needed
- serial_number, model, manufacturer, description are all optional

## Requirements

### New form fields (in order within form)
1. **Bộ phận quản lý** (managed_by) — text input, optional
2. **Đang sở hữu** (owned_by) — text input, optional
3. **Số serial** (serial_number) — text input, optional
4. **Model** (model) — text input, optional
5. **Hãng sản xuất** (manufacturer) — text input, optional
6. **Mô tả** (description) — textarea, optional

### Layout
- managed_by + owned_by: side by side (grid 2-col)
- serial_number + model: side by side
- manufacturer: full width or half
- description: full width textarea

## Related Code Files
- **Modify:** `frontend/src/components/device-form.jsx`
- **Maybe create:** `frontend/src/components/device-image-upload.jsx` (only if form exceeds ~220 lines)

## Implementation Steps

### 1. Add state for new fields
```js
const [managedBy, setManagedBy] = useState(initialData?.managed_by || '');
const [ownedBy, setOwnedBy] = useState(initialData?.owned_by || '');
const [serialNumber, setSerialNumber] = useState(initialData?.serial_number || '');
const [model, setModel] = useState(initialData?.model || '');
const [manufacturer, setManufacturer] = useState(initialData?.manufacturer || '');
const [description, setDescription] = useState(initialData?.description || '');
```

### 2. Append to FormData in handleSubmit
```js
formData.append('managed_by', managedBy.trim());
formData.append('owned_by', ownedBy.trim());
formData.append('serial_number', serialNumber.trim());
formData.append('model', model.trim());
formData.append('manufacturer', manufacturer.trim());
formData.append('description', description.trim());
```

### 3. Add input fields after location select, before image upload section

Use section headers to visually group:
- Section: "Quản lý & Sở hữu" — managed_by, owned_by
- Section: "Thông tin thiết bị" — serial_number, model, manufacturer, description

### 4. Modularization check
After adding fields, check line count. If >220, extract image upload block into `device-image-upload.jsx`.

## Todo List
- [ ] Add 6 new state variables
- [ ] Add fields to FormData in handleSubmit
- [ ] Add "Quản lý & Sở hữu" section with managed_by, owned_by inputs
- [ ] Add "Thông tin thiết bị" section with serial_number, model, manufacturer inputs
- [ ] Add description textarea
- [ ] Modularize if form exceeds 220 lines

## Success Criteria
- All new fields render in form
- Values pre-populate correctly in edit mode
- FormData includes all fields on submit
- File stays under 200 lines (modularize if needed)

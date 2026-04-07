# Phase 4: Frontend — Core Pages

## Context Links
- [Plan Overview](plan.md)
- [Phase 3: Backend API](phase-03-backend-api-routes.md)

## Overview
- **Priority**: P1
- **Status**: Pending
- **Effort**: 3h
- **Blocked by**: Phase 3
- **Description**: Build React pages — device list (grid), create/edit forms with image upload, detail page with full image display. Set up routing with react-router-dom.

## Key Insights
- Use `react-router-dom` v6 with `createBrowserRouter` for data loading patterns
- Images served from `/api/devices/:id/image` — use as `<img src>` directly
- axios for API calls; create a shared api client module
- Tailwind v4 utility classes for all styling — no component library needed

## Requirements

### Functional
- Device list page: grid of cards showing name, thumbnail, creation date
- Device create page: form with name input + image file picker
- Device edit page: pre-filled form, optional image replacement
- Device detail page: full-size image, device info, navigation back to list
- Navigation between all pages

### Non-functional
- Loading states for API calls
- Error handling with user-friendly messages
- Responsive layout (mobile-friendly grid)
- Image preview before upload

## Architecture

### Routing Structure
```
/                    → Device list (redirect or default)
/devices             → Device list page
/devices/new         → Device create page
/devices/:id         → Device detail page
/devices/:id/edit    → Device edit page
/public/device/:id   → Public device page (Phase 5)
```

### Component Tree
```
App.jsx
├── DeviceListPage
│   └── DeviceCard (×N)
├── DeviceCreatePage
│   └── DeviceForm
├── DeviceEditPage
│   └── DeviceForm (pre-filled)
└── DeviceDetailPage
```

### Data Flow
```
Pages → axios GET/POST/PUT/DELETE → /api/devices/*
                                         ↓
                                    JSON response
                                         ↓
                                  React state update → re-render
```

## Related Code Files

### Files to Create
```
frontend/src/api/device-api.js        # axios API client
frontend/src/App.jsx                   # Router setup (overwrite template)
frontend/src/pages/device-list-page.jsx
frontend/src/pages/device-detail-page.jsx
frontend/src/pages/device-create-page.jsx
frontend/src/pages/device-edit-page.jsx
frontend/src/components/device-card.jsx
frontend/src/components/device-form.jsx
```

### Files to Modify
```
frontend/src/main.jsx    # Mount App with BrowserRouter
frontend/src/index.css   # Base styles + Tailwind import
```

## Implementation Steps

### 1. Create API Client

`frontend/src/api/device-api.js`:
```javascript
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const getDevices = () => api.get('/devices').then(r => r.data);
export const getDevice = (id) => api.get(`/devices/${id}`).then(r => r.data);
export const createDevice = (formData) => api.post('/devices', formData).then(r => r.data);
export const updateDevice = (id, formData) => api.put(`/devices/${id}`, formData).then(r => r.data);
export const deleteDevice = (id) => api.delete(`/devices/${id}`);

export const deviceImageUrl = (id) => `/api/devices/${id}/image`;
export const deviceQrcodeUrl = (id) => `/api/devices/${id}/qrcode`;
```

### 2. Set Up Router

`frontend/src/App.jsx`:
```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DeviceListPage from './pages/device-list-page';
import DeviceCreatePage from './pages/device-create-page';
import DeviceDetailPage from './pages/device-detail-page';
import DeviceEditPage from './pages/device-edit-page';
import PublicDevicePage from './pages/public-device-page';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/devices" replace />} />
        <Route path="/devices" element={<DeviceListPage />} />
        <Route path="/devices/new" element={<DeviceCreatePage />} />
        <Route path="/devices/:id" element={<DeviceDetailPage />} />
        <Route path="/devices/:id/edit" element={<DeviceEditPage />} />
        <Route path="/public/device/:id" element={<PublicDevicePage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### 3. Implement Device List Page

`frontend/src/pages/device-list-page.jsx`:
- Fetch devices on mount with `useEffect`
- Render grid of `DeviceCard` components
- "Add Device" button → navigates to `/devices/new`
- Loading spinner while fetching
- Empty state message when no devices

```jsx
// Key structure:
const [devices, setDevices] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  getDevices().then(setDevices).finally(() => setLoading(false));
}, []);

// Grid layout: grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6
```

### 4. Implement Device Card Component

`frontend/src/components/device-card.jsx`:
- Thumbnail image (or placeholder if no image)
- Device name
- Creation date (formatted)
- Click → navigate to `/devices/:id`

```jsx
// Image src: deviceImageUrl(device.id)
// Fallback: gray placeholder div with icon
// Date: new Date(device.created_at).toLocaleDateString()
```

### 5. Implement Device Form Component

`frontend/src/components/device-form.jsx`:
- Shared between create and edit pages
- Props: `initialData`, `onSubmit`, `submitLabel`
- Name text input (required)
- Image file input with preview
- Image preview: show existing image (edit) or selected file (create)
- Submit builds FormData and calls `onSubmit`

```jsx
function DeviceForm({ initialData, onSubmit, submitLabel = 'Save' }) {
  const [name, setName] = useState(initialData?.name || '');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(
    initialData?.id ? deviceImageUrl(initialData.id) : null
  );

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', name);
    if (imageFile) formData.append('image', imageFile);
    onSubmit(formData);
  };
  // ... render form
}
```

### 6. Implement Create Page

`frontend/src/pages/device-create-page.jsx`:
- Renders `DeviceForm` with no initial data
- On submit: call `createDevice(formData)`, navigate to `/devices/:id` on success
- Error state for failed creation

### 7. Implement Edit Page

`frontend/src/pages/device-edit-page.jsx`:
- Fetch device by ID on mount
- Render `DeviceForm` with pre-filled data
- On submit: call `updateDevice(id, formData)`, navigate to `/devices/:id`
- 404 handling if device not found

### 8. Implement Detail Page

`frontend/src/pages/device-detail-page.jsx`:
- Fetch device by ID on mount
- Display: full-size image, device name, device ID, creation date
- Buttons: Edit, Delete (with confirm), Back to list
- QR code display (placeholder — wired in Phase 5)
- Delete: confirm dialog → `deleteDevice(id)` → navigate to `/devices`

## Todo List

- [ ] Create `device-api.js` with all API functions
- [ ] Set up React Router in `App.jsx`
- [ ] Implement `DeviceCard` component
- [ ] Implement `DeviceForm` component with image preview
- [ ] Implement `DeviceListPage` with grid layout
- [ ] Implement `DeviceCreatePage`
- [ ] Implement `DeviceEditPage` with data fetching
- [ ] Implement `DeviceDetailPage` with delete functionality
- [ ] Add loading states and error handling to all pages
- [ ] Style all pages with Tailwind (responsive grid, buttons, forms)
- [ ] Test navigation flow: list → create → detail → edit → list

## Success Criteria
- Full navigation flow works without errors
- Device creation with image upload persists to backend
- Device list shows all devices with thumbnails
- Edit page pre-fills existing data, optional image replacement
- Delete removes device and returns to list
- Responsive layout works on mobile and desktop
- Loading and error states displayed appropriately

## Risk Assessment
- **Image preview memory leaks**: `URL.createObjectURL` creates blob URLs — must `URL.revokeObjectURL` on cleanup
- **Large image display**: CSS `object-fit: cover` + `max-height` prevents layout breakage
- **Route order matters**: `/devices/new` must be before `/devices/:id` in route config

## Security Considerations
- File input accepts only `image/*` via `accept` attribute (client-side; server enforces via multer)
- Delete confirmation dialog prevents accidental deletion

## Next Steps
→ Phase 5: QR code display, print functionality, public device page

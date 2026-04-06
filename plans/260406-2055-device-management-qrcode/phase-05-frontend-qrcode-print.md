# Phase 5: Frontend — QR Code & Print

## Context Links
- [Plan Overview](plan.md)
- [Phase 4: Frontend Core Pages](phase-04-frontend-core-pages.md)

## Overview
- **Priority**: P1
- **Status**: Pending
- **Effort**: 1.5h
- **Blocked by**: Phase 4
- **Description**: Add QR code display component, print functionality with clean print CSS, and the public device page rendered when QR codes are scanned

## Key Insights
- QR code served as PNG from `/api/devices/:id/qrcode` — just use as `<img>` src
- Print: use `window.print()` with `@media print` CSS to isolate QR code + label
- Public page is a lightweight React route — fetches device info from `/api/public/device/:id`
- Print should include device name + ID alongside QR for identification

## Requirements

### Functional
- QR code displayed on device detail page
- Print button triggers browser print with only QR code + device label visible
- Public device page shows device name + device ID when accessed via QR scan

### Non-functional
- Print output clean — no navigation, no background, just QR + label
- Public page loads fast — minimal data fetch
- QR code image has alt text for accessibility

## Architecture

### Print Flow
```
User clicks Print → window.print() triggered
  → @media print CSS hides everything except .print-area
  → .print-area contains: QR image + device name + device ID
  → Browser print dialog opens
```

### Public Page Flow
```
QR scan → browser opens /public/device/:id
  → React renders PublicDevicePage
  → Fetches GET /api/public/device/:id
  → Displays device name + device ID (minimal layout)
```

## Related Code Files

### Files to Create
```
frontend/src/components/qrcode-display.jsx
frontend/src/components/print-qrcode-button.jsx
frontend/src/pages/public-device-page.jsx
```

### Files to Modify
```
frontend/src/pages/device-detail-page.jsx  (integrate QR + print)
frontend/src/pages/device-list-page.jsx    (add QR thumbnail to cards)
frontend/src/index.css                      (add @media print rules)
```

## Implementation Steps

### 1. Create QR Code Display Component

`frontend/src/components/qrcode-display.jsx`:
```jsx
import { deviceQrcodeUrl } from '../api/device-api';

export default function QrcodeDisplay({ deviceId, className = '' }) {
  return (
    <img
      src={deviceQrcodeUrl(deviceId)}
      alt="Device QR Code"
      className={`${className}`}
    />
  );
}
```

### 2. Create Print QR Code Button

`frontend/src/components/print-qrcode-button.jsx`:
```jsx
export default function PrintQrcodeButton({ deviceId, deviceName }) {
  const handlePrint = () => {
    // Set data attributes for print area, then trigger print
    const printArea = document.getElementById('print-area');
    if (printArea) {
      window.print();
    }
  };

  return (
    <button
      onClick={handlePrint}
      className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 flex items-center gap-2"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
      </svg>
      Print QR Code
    </button>
  );
}
```

### 3. Add Print CSS

Add to `frontend/src/index.css`:
```css
@media print {
  body * {
    visibility: hidden;
  }
  #print-area,
  #print-area * {
    visibility: visible;
  }
  #print-area {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
  }
  #print-area img {
    width: 200px;
    height: 200px;
  }
}
```

### 4. Integrate into Device Detail Page

Update `device-detail-page.jsx` to include:
```jsx
{/* Print area — hidden on screen, visible on print */}
<div id="print-area" className="print:block">
  <QrcodeDisplay deviceId={device.id} className="w-48 h-48 mx-auto" />
  <p className="mt-2 text-lg font-bold">{device.name}</p>
  <p className="text-sm text-gray-600">ID: {device.id}</p>
</div>

{/* Print button */}
<PrintQrcodeButton deviceId={device.id} deviceName={device.name} />

{/* QR code visible on screen too */}
<QrcodeDisplay deviceId={device.id} className="w-48 h-48" />
```

### 5. Implement Public Device Page

`frontend/src/pages/public-device-page.jsx`:
```jsx
import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function PublicDevicePage() {
  const { id } = useParams();
  const [device, setDevice] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`/api/public/device/${id}`)
      .then(r => setDevice(r.data))
      .catch(() => setError('Device not found'));
  }, [id]);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-red-500 text-xl">{error}</p>
    </div>
  );

  if (!device) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">{device.name}</h1>
        <p className="text-gray-600">Device ID: <span className="font-mono">{device.id}</span></p>
      </div>
    </div>
  );
}
```

### 6. Add QR Thumbnail to List Cards (Optional Enhancement)

In `device-card.jsx`, add small QR code thumbnail:
```jsx
<img
  src={deviceQrcodeUrl(device.id)}
  alt="QR"
  className="w-12 h-12 absolute bottom-2 right-2 opacity-80"
/>
```

## Todo List

- [ ] Create `QrcodeDisplay` component
- [ ] Create `PrintQrcodeButton` component
- [ ] Add `@media print` CSS rules to `index.css`
- [ ] Add print area markup to device detail page
- [ ] Integrate QR display + print button into detail page
- [ ] Implement `PublicDevicePage` (fetch + render name + ID)
- [ ] Add QR thumbnail to device list cards
- [ ] Test print output in Chrome and Firefox
- [ ] Test public page via direct URL access
- [ ] Verify QR code resolves to correct public URL

## Success Criteria
- QR code displays on device detail page
- Print button opens browser print dialog with only QR + label visible
- Printed output is clean — no navigation elements, centered QR with device info
- Public page shows device name + ID when accessed directly
- Public page handles non-existent device ID gracefully (error message)

## Risk Assessment
- **Print CSS browser inconsistency**: Test Chrome + Firefox; `visibility: hidden/visible` pattern is widely supported
- **Public page SEO**: Not needed for internal tool; no meta tags required
- **QR image loading**: If backend is slow, QR `<img>` shows broken icon → add loading placeholder or `onError` fallback

## Security Considerations
- Public page exposes only device name + ID — no sensitive data
- No auth bypass risk since entire app is public by design

## Next Steps
→ Phase 6: Docker containerization and deployment

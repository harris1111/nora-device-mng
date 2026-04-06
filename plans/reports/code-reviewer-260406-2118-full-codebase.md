# Code Review: Nora Device Manager — Full Codebase

**Date:** 2026-04-06  
**Reviewer:** code-reviewer  
**Scope:** All backend + frontend + Docker files (~500 LOC)

---

## Overall Assessment

Clean, minimal CRUD app. Good separation of concerns, appropriate tech choices for a self-hosted tool. However, several **security vulnerabilities**, **data integrity bugs**, and **production failure modes** need addressing before this is production-ready.

---

## Critical Issues

### C1. No CORS restriction — any origin can call admin APIs

**File:** `backend/src/index.js:18`  
```js
app.use(cors());
```

Wide-open CORS. Any website a user visits can issue DELETE/PUT requests to the device API if the user's browser has network access to this service. For a self-hosted app on a LAN, this means any malicious page can wipe all devices.

**Fix:** Restrict to the app's own origin:
```js
app.use(cors({ origin: process.env.BASE_URL || 'http://localhost:3000' }));
```

---

### C2. No authentication — all CRUD operations are publicly accessible

No auth middleware exists. Anyone with network access can create, modify, and delete devices. The `/api/public/device/:id` route exists to serve limited data, but the full CRUD API is equally open.

**Fix:** Add at minimum basic auth or a shared API key for admin routes. Even a simple `Authorization: Bearer <token>` check from an env var would suffice.

---

### C3. Unvalidated `Content-Type` header from DB — response header injection

**File:** `backend/src/routes/device-routes.js:96`  
```js
res.set('Content-Type', data.image_mime);
```

`image_mime` comes from whatever multer stored (which is the client-declared MIME type). A malicious upload can set `Content-Type: text/html` and store an HTML payload as the "image" BLOB. When served back, the browser renders it — stored XSS.

The multer `fileFilter` only checks `file.mimetype.startsWith('image/')` but `image/svg+xml` passes this check and SVGs can contain embedded JavaScript.

**Fix:**
1. Allowlist MIME types: `['image/jpeg', 'image/png', 'image/webp', 'image/gif']`
2. Reject SVG explicitly
3. Add `Content-Disposition: inline` and `X-Content-Type-Options: nosniff` to image responses

---

### C4. Error handler leaks internal error messages to client

**File:** `backend/src/routes/device-routes.js:64`  
```js
res.status(500).json({ error: err.message });
```

`err.message` can include SQLite internal errors, file system paths, or stack details. This leaks implementation details to attackers.

**Fix:** Log the real error server-side, return generic message to client:
```js
console.error('Create device error:', err);
res.status(500).json({ error: 'Internal server error' });
```

---

## High Priority

### H1. `updateDevice` silently drops image on falsy check

**File:** `backend/src/database.js:72`  
```js
if (image) {
```

If `image` is an empty Buffer (length 0), it's truthy — the DB stores an empty BLOB. If `image` is `null` (no new file uploaded), the existing image is preserved. But in `device-routes.js:78-79`:

```js
image: req.file?.buffer || null,
imageMime: req.file?.mimetype || null,
```

When no new image is uploaded, `image` is `null` so the DB path skips image update — correct. But `imageMime` is also `null`, meaning if you update just the name, the mime type is NOT updated (also correct). However, there's no way to **remove** an existing image. The UI has no "remove image" button and the API has no mechanism for it.

**Severity:** Design gap, not a bug. But users cannot undo an image upload.

---

### H2. No request size limit on `express.json()`

**File:** `backend/src/index.js:19`  
```js
app.use(express.json());
```

Default limit is 100KB which is reasonable, but it should be explicit. More importantly, there's no rate limiting at all — an attacker can spam device creation to fill the SQLite DB and disk.

**Fix:** Add explicit limit and consider rate limiting:
```js
app.use(express.json({ limit: '100kb' }));
```

---

### H3. SPA fallback catches API 404s in production

**File:** `backend/src/index.js:36-38`  
```js
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});
```

Any `GET` to a non-existent API route returns `index.html` with 200 status in production. For example, `GET /api/nonexistent` returns HTML instead of a JSON 404. This breaks API clients and makes debugging confusing.

**Fix:**
```js
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});
```

---

### H4. No global unhandled error handler — Express silently swallows errors

**File:** `backend/src/index.js:42-53`

The error handler only catches multer errors and the specific "Only image files allowed" string. Any other error from a sync route handler crashes silently (no response sent) or hangs the request. The async POST handler has its own try/catch, but the PUT handler does NOT — if `updateDevice` throws, the request hangs.

**Fix:** Add a catch-all error handler at the bottom:
```js
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
```

And wrap the PUT handler in try/catch or use an async error wrapper.

---

### H5. Docker: `apk del` after `npm ci` may break native addons at runtime

**File:** `Dockerfile:18`  
```dockerfile
RUN npm ci --production && apk del python3 make g++
```

`better-sqlite3` is a native addon. Removing `g++` is fine (only needed for compilation), but verify that the shared libraries it links against (like `libstdc++`) are still available after `apk del`. On Alpine, `g++` pulls in `libstdc++` as a dependency — removing `g++` may remove `libstdc++` too, causing runtime segfaults.

**Fix:** Keep `libstdc++` explicitly:
```dockerfile
RUN npm ci --production && apk del python3 make g++ && apk add --no-cache libstdc++
```

---

### H6. Database path is hardcoded relative to source — breaks in Docker

**File:** `backend/src/database.js:6`  
```js
const DB_PATH = path.join(__dirname, '..', 'data', 'devices.db');
```

In Docker, `__dirname` resolves to `/app/src`, so DB_PATH is `/app/data/devices.db`. The Docker volume mounts at `/app/data`. This works by coincidence of the WORKDIR layout, but it's fragile. If someone changes WORKDIR or copies files differently, the DB path breaks.

**Fix:** Use an env var with fallback:
```js
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'devices.db');
```

---

## Medium Priority

### M1. `handleDelete` has no error handling

**File:** `frontend/src/pages/device-detail-page.jsx:21-25`
```js
const handleDelete = async () => {
  if (!window.confirm(`Delete "${device.name}"?`)) return;
  await deleteDevice(id);
  navigate('/devices');
};
```

If `deleteDevice` fails, the unhandled promise rejection is swallowed. User sees nothing. Navigation doesn't happen but no error is shown.

**Fix:** Wrap in try/catch, show error state.

---

### M2. No input length validation on device name

Backend accepts any length string for `name`. SQLite TEXT has no inherent limit. A user (or attacker) could submit a multi-MB name string.

**Fix:** Add `if (name.trim().length > 255)` check in the route handlers.

---

### M3. Vite proxy config missing `/public` prefix mapping

**File:** `frontend/vite.config.js:9`
```js
'/public': 'http://localhost:3000',
```

The public device page hits `/api/public/device/:id` which is already covered by the `/api` proxy. The `/public` proxy would match the frontend route `/public/device/:id` (which is a client-side route, not an API call). This proxy rule is unnecessary and potentially confusing — it would proxy the HTML page request during dev.

**Fix:** Remove the `/public` proxy entry. Only `/api` is needed.

---

### M4. `PublicDevicePage` imports axios directly instead of using the API module

**File:** `frontend/src/pages/public-device-page.jsx:3`
```js
import axios from 'axios';
```

All other pages use `device-api.js`. This page imports axios directly. Inconsistent pattern — if the base URL changes, this page breaks while others don't.

**Fix:** Add a `getPublicDevice` function to `device-api.js` and use it here.

---

### M5. Memory leak potential in `DeviceForm` on unmount

**File:** `frontend/src/components/device-form.jsx:19`

`URL.createObjectURL` is called but `URL.revokeObjectURL` is only called when selecting a new image (line 18). If the component unmounts with a blob URL active, it leaks. Need a cleanup effect.

**Fix:**
```js
useEffect(() => {
  return () => {
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
  };
}, [imagePreview]);
```

---

### M6. `created_at` timezone handling is fragile

**File:** `frontend/src/components/device-card.jsx:26`
```js
new Date(device.created_at + 'Z')
```

SQLite's `datetime('now')` stores UTC without a `Z` suffix. The frontend appends `Z` to force UTC parsing. This works but is brittle — if the DB ever stores a timezone-aware string, the double-Z would break parsing.

**Fix:** Store as ISO 8601 with explicit `Z` in the DB, or use Unix timestamps.

---

### M7. No pagination on device list

`getAllDevices()` returns all devices. With thousands of devices, this becomes a performance issue — both the query and the JSON serialization. The frontend renders all cards at once.

**Fix:** Add `LIMIT/OFFSET` pagination or cursor-based pagination.

---

## Low Priority

### L1. QR code is generated once and never regenerated

If `BASE_URL` changes after device creation, all existing QR codes point to the old URL. There's no mechanism to regenerate QR codes.

### L2. No favicon or app title

The SPA has no `<title>` set per page and likely no favicon configured. Minor UX gap.

### L3. `better-sqlite3` prepared statements are re-created on every call

Each DB function calls `db.prepare()` every invocation. `better-sqlite3` caches these internally, so this isn't a performance issue, but explicitly caching them is more idiomatic.

### L4. No `helmet` middleware for security headers

Missing standard security headers (`X-Frame-Options`, `X-Content-Type-Options`, `CSP`, etc.). For a self-hosted internal tool, low risk but still best practice.

---

## Positive Observations

- BLOBs excluded from list queries — good performance awareness
- WAL mode enabled for SQLite — correct for concurrent reads
- Multi-stage Docker build — keeps image small
- Non-root user in Docker container
- Healthcheck configured in Dockerfile
- Clean component decomposition in frontend
- Proper use of `FormData` for multipart uploads
- Print CSS isolation is well done

---

## Recommended Actions (Priority Order)

1. **[CRITICAL]** Allowlist image MIME types, reject SVG, add `nosniff` header (C3)
2. **[CRITICAL]** Restrict CORS origin (C1)
3. **[CRITICAL]** Stop leaking error internals to clients (C4)
4. **[HIGH]** Fix SPA fallback to exclude `/api/*` routes (H3)
5. **[HIGH]** Add catch-all Express error handler (H4)
6. **[HIGH]** Ensure `libstdc++` survives in Docker after `apk del` (H5)
7. **[HIGH]** Add auth for admin CRUD routes (C2 — may be acceptable for internal use, but flag it)
8. **[MEDIUM]** Add error handling to `handleDelete` (M1)
9. **[MEDIUM]** Add name length validation (M2)
10. **[MEDIUM]** Fix blob URL memory leak in DeviceForm (M5)
11. **[MEDIUM]** Use API module consistently in PublicDevicePage (M4)
12. **[LOW]** Add `helmet` middleware (L4)
13. **[LOW]** Add pagination to device list (M7)

---

## Unresolved Questions

1. Is this intended for LAN-only / single-user use? If so, C2 (no auth) may be acceptable-as-is but should be documented.
2. What's the expected device count? If >1000, pagination (M7) becomes HIGH priority.
3. Is `BASE_URL` expected to change? If yes, QR regeneration (L1) needs a solution.

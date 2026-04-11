# Phase 2: S3-Compatible File Storage

## Context Links
- Phase 1 (dependency): [phase-01-postgres-prisma-migration.md](phase-01-postgres-prisma-migration.md)
- Current image handling: `backend/src/routes/device-routes.js` lines 170-177 (BLOB serve)
- Multer config: `backend/src/routes/device-routes.js` lines 22-34

## Overview
- **Priority:** P1 — Phases 3 and 6 depend on this
- **Status:** Pending (blocked by Phase 1)
- **Effort:** 3h
- **Branch:** `feat/s3-file-storage`

Create a generic S3 utility module using AWS SDK v3. Works with any S3-compatible service (AWS, iDrive E2, MinIO, Backblaze B2). No route changes in this phase — just the utility + env config.

## Key Insights
- AWS SDK v3 modular: only need `@aws-sdk/client-s3` (small install)
- S3 keys should be deterministic: `devices/{deviceId}/{uuid}.{ext}` for easy management
- Upload returns the S3 key; download streams the object — no temp files
- Delete is idempotent (no error if key doesn't exist)

## Requirements

### Functional
- Upload file buffer → S3, return `{ key, url }`
- Download file by key → return stream + content-type
- Delete file by key
- Generate presigned URL (optional, for direct browser downloads)

### Non-Functional
- Fail-fast if S3 env vars missing on startup
- Retry on transient S3 errors (SDK built-in)
- Max file size enforced at multer level (existing 5MB), not S3 level

## Architecture

### Data Flow
```
Multer (memory buffer) → s3-client.js upload() → S3 bucket
                                                    ↓
Browser GET /api/attachments/:id/file → s3-client.js download() → stream to response
```

### Environment Variables
```env
S3_ENDPOINT=https://xxx.e2.idrivee2.com   # required
S3_ACCESS_KEY=abc123                        # required
S3_SECRET_KEY=secret456                     # required
S3_BUCKET=nora-devices                      # required
S3_REGION=us-east-1                         # optional, default: us-east-1
```

## Related Code Files

### Files to Create
- `backend/src/lib/s3-client.js` — S3Client singleton + upload/download/delete helpers
- `backend/src/utils/s3-config-validator.js` — validate env vars on startup

### Files to Modify
- `backend/package.json` — add `@aws-sdk/client-s3`
- `backend/src/index.js` — call S3 config validator on startup
- `docker-compose.yml` — add S3 env var placeholders
- `.env.example` — document S3 vars (create if not exists)

## Implementation Steps

### 1. Install AWS SDK v3
```bash
cd backend && npm install @aws-sdk/client-s3
```

### 2. Create S3 client module

```js
// backend/src/lib/s3-client.js
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true, // required for most S3-compatible services
});

const BUCKET = process.env.S3_BUCKET;

export async function uploadFile(key, buffer, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return key;
}

export async function downloadFile(key) {
  const resp = await s3.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
  return { stream: resp.Body, contentType: resp.ContentType };
}

export async function deleteFile(key) {
  await s3.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
}

export async function deleteFiles(keys) {
  await Promise.all(keys.map(k => deleteFile(k)));
}
```

### 3. Create config validator

```js
// backend/src/utils/s3-config-validator.js
const REQUIRED = ['S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET'];

export function validateS3Config() {
  const missing = REQUIRED.filter(k => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing S3 env vars: ${missing.join(', ')}`);
  }
}
```

### 4. Update index.js
Add `validateS3Config()` call at startup, after Prisma connect.

### 5. Update docker-compose.yml
Add S3 env vars to app service:
```yaml
environment:
  - S3_ENDPOINT=${S3_ENDPOINT}
  - S3_ACCESS_KEY=${S3_ACCESS_KEY}
  - S3_SECRET_KEY=${S3_SECRET_KEY}
  - S3_BUCKET=${S3_BUCKET:-nora-devices}
  - S3_REGION=${S3_REGION:-us-east-1}
```

### 6. Create .env.example
```env
# S3-compatible storage
S3_ENDPOINT=https://xxx.e2.idrivee2.com
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=nora-devices
S3_REGION=us-east-1
```

## Todo List

- [ ] Install `@aws-sdk/client-s3`
- [ ] Create `src/lib/s3-client.js` with upload/download/delete
- [ ] Create `src/utils/s3-config-validator.js`
- [ ] Update `index.js` to validate S3 config on startup
- [ ] Update `docker-compose.yml` with S3 env vars
- [ ] Create `.env.example`
- [ ] Test upload/download/delete manually against real S3 bucket

## Success Criteria
- App fails to start if S3 env vars missing (clear error message)
- `uploadFile()` successfully uploads buffer to S3 bucket
- `downloadFile()` returns readable stream with correct content-type
- `deleteFile()` removes object without error
- Module exports are importable from route files

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| S3 credentials invalid at deploy | Med | High | Fail-fast validator on startup |
| `forcePathStyle` incompatible with provider | Low | Med | Documented; most S3-compat services need it |
| Large file uploads timeout | Low | Low | 5MB multer limit already in place |

## Security Considerations
- S3 credentials in env vars only, never committed
- Bucket should NOT have public access — files served through Express (auth-gated if needed later)
- `forcePathStyle: true` avoids DNS-based bucket routing (prevents SSRF via bucket name)

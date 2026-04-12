# Code Standards — Nora Device Manager

Last updated: April 12, 2026

## Overview

This document defines the architectural patterns, conventions, and standards used throughout the Nora Device Manager codebase. All new code must follow these standards.

## File Organization

### Naming Conventions

- **Files**: kebab-case (`device-form.tsx`, `attachment-list.tsx`, `device-routes.ts`)
- **Variables/Functions**: camelCase (`deviceId`, `mapDevice()`, `fetchAttachments()`)
- **Classes/Types**: PascalCase (`MaintenanceRecord`, `Device`)
- **Enums**: UPPER_SNAKE_CASE (for TypeScript enums) or camelCase (for string unions)
- **Constants**: UPPER_SNAKE_CASE (`MAX_FILE_SIZE`, `ALLOWED_MIMES`)

### File Size Limits

- **Target**: Keep individual files under 200 lines of code
- **Rationale**: Optimal for token efficiency and LLM context management
- **When to split**: 
  - Components with 150+ lines → Extract smaller subcomponents
  - Routes with 200+ lines → Split by feature (devices, maintenance, attachments)
  - Utils with 150+ lines → Create separate modules

### Directory Structure

```
backend/src/
  lib/          # External service clients (Prisma, S3, etc.)
  routes/       # Express route handlers
  scripts/      # One-time scripts (migrations)
  types/        # Type declarations (augmentations)
  utils/        # Helper functions (mappers, validators, generators)

frontend/src/
  api/          # API clients (Axios)
  components/   # Reusable UI components
  pages/        # Page/route components
  styles/       # Global styles
```

## Backend Standards

### TypeScript Configuration

- **Mode**: strict
- **Target**: ES2022
- **Module**: ES2020 (ESM)
- **Runtime**: tsx (no compile step)
- **Imports**: Must use `.js` extension for relative TS imports (ESM requirement)

Example:
```typescript
import { mapDevice } from '../utils/response-mapper.js'; // CORRECT
import { mapDevice } from '../utils/response-mapper';      // WRONG
```

### Express Pattern

**Route File Structure**:
```typescript
import { Router, type Request, type Response } from 'express';
import prisma from '../lib/prisma-client.js';

const router = Router();

// GET /api/devices
router.get('/', async (req: Request, res: Response) => {
  try {
    // Business logic
    res.json({ /* response */ });
  } catch (err) {
    console.error('Error message:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

**Error Handling**:
- Try/catch in all route handlers
- Log errors with context (`console.error('Operation: error', err)`)
- Return appropriate HTTP status codes (400, 404, 500)
- Never expose internal error details to client

### Multer File Upload Pattern

**Setup** (in route file):
```typescript
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed') as unknown as null, false);
    }
  },
});

// For multiple named fields:
const deviceUpload = upload.fields([
  { name: 'primary_image', maxCount: 1 },
  { name: 'attachments', maxCount: 9 },
]);

// For array of unnamed files:
const maintenanceUpload = upload.array('files', 5);
```

**In Route**:
```typescript
router.post('/', deviceUpload, async (req: Request, res: Response) => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const primaryFile = files?.primary_image?.[0];
  const attachmentFiles = files?.attachments || [];
  
  // Handle files...
});
```

### S3 Upload Pattern

**Setup** (in `s3-client.ts`):
```typescript
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true, // Required for S3-compatible providers
});

export async function uploadFile(key: string, body: Buffer, contentType: string) {
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}
```

**Usage** (in device-routes.ts):
```typescript
const attachmentId = uuidv4();
const ext = path.extname(file.originalname) || '.jpg';
const key = `devices/${deviceId}/${attachmentId}${ext}`;

await uploadFile(key, file.buffer, file.mimetype);

await prisma.attachment.create({
  data: {
    id: attachmentId,
    deviceId,
    fileKey: key,
    fileName: file.originalname,
    fileType: file.mimetype,
    fileSize: file.size,
    isPrimary: isPrimary,
  },
});
```

### Response Mapping

**Purpose**: Convert Prisma objects (snake_case) to API responses (snake_case) with consistent structure.

**Pattern** (in `response-mapper.ts`):
```typescript
export function mapDevice(prismaDevice: DeviceWithIncludes) {
  return {
    id: prismaDevice.id,
    name: prismaDevice.name,
    store_id: prismaDevice.storeId,
    // ... other fields
    attachments: prismaDevice.attachments.map(att => ({
      id: att.id,
      file_name: att.fileName,
      file_type: att.fileType,
      file_size: att.fileSize,
      is_primary: att.isPrimary,
    })),
  };
}
```

**Changed in April 2026**: Removed `image_mime` field; attachments now come from S3 Attachment records.

### Validation Pattern

**Type Validation** (in `device-status-rules.ts`):
```typescript
export function validateTypeStatus(type: string, status: string): string | null {
  const allowed = {
    'tai_san': ['active', 'maintenance', 'disposed', 'lost', 'transferred'],
    'hang_hoai': ['active', 'disposed'],
    'che_do': ['active'],
  };
  
  if (!allowed[type]?.includes(status)) {
    return `Invalid status "${status}" for type "${type}"`;
  }
  return null;
}
```

### Prisma Query Pattern

**Include Strategy**:
```typescript
const deviceIncludes = {
  location: true,
  attachments: { 
    where: { isPrimary: true }, // Only primary image
    select: { id: true, isPrimary: true },
    take: 1,
  },
};

const device = await prisma.device.findUnique({
  where: { id: deviceId },
  include: deviceIncludes,
});
```

**Rationale**: Minimize JOIN overhead by:
- Only selecting needed fields
- Filtering at query level (not in-memory)
- Taking first result to avoid unnecessary rows

## Frontend Standards

### TypeScript Configuration

- **Mode**: strict (react-jsx)
- **Lib**: ES2020, DOM
- **Target**: ES2020

### Component Structure

**Function Components** (no class components):
```typescript
interface DeviceFormProps {
  onSubmit: (data: DeviceFormData) => Promise<void>;
  initialData?: Device;
  loading?: boolean;
}

export default function DeviceForm({ 
  onSubmit, 
  initialData, 
  loading = false,
}: DeviceFormProps) {
  const [formData, setFormData] = useState<DeviceFormData>({...});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSubmit(formData);
    } catch (err) {
      console.error('Form submission error:', err);
      setErrors({ form: 'Submission failed' });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* fields */}
    </form>
  );
}
```

### API Client Pattern

**Axios Setup** (in `device-api.ts`):
```typescript
import axios from 'axios';

interface Device {
  id: string;
  name: string;
  store_id: string;
  // ... fields (snake_case from API)
}

const API_BASE = '/api';

export async function createDevice(data: FormData): Promise<Device> {
  const response = await axios.post<Device>(
    `${API_BASE}/devices`,
    data,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return response.data;
}

export async function fetchDevices(params?: FilterParams): Promise<Device[]> {
  const response = await axios.get<Device[]>(
    `${API_BASE}/devices`,
    { params }
  );
  return response.data;
}
```

### Form Upload Pattern (FormData)

**Usage in Component**:
```typescript
const handleSubmit = async (formData: DeviceFormData, files: { primary?: File; attachments?: File[] }) => {
  const payload = new FormData();
  payload.append('name', formData.name);
  payload.append('store_id', formData.storeId);
  
  if (files.primary) {
    payload.append('primary_image', files.primary);
  }
  
  if (files.attachments) {
    for (const file of files.attachments) {
      payload.append('attachments', file);
    }
  }

  const response = await createDevice(payload);
  return response;
};
```

### New Component: AttachmentList

**Props**:
```typescript
interface AttachmentListProps {
  attachments: Attachment[];
  onDelete?: (id: string) => Promise<void>;
  readOnly?: boolean;
  loading?: boolean;
}
```

**Features**:
- Reusable table for Device and Maintenance attachments
- View action: opens PdfViewerModal for PDFs, downloads images
- Download action: streams file from S3
- Delete action (if !readOnly): calls onDelete callback

### New Component: PdfViewerModal

**Props**:
```typescript
interface PdfViewerModalProps {
  url: string | null;
  onClose: () => void;
}
```

**Renders**: `<iframe src={url} />` for embedded PDF viewing.

### State Management

- **useState**: For local form state and UI state
- **useEffect**: For side effects (data fetching, cleanup)
- **Custom hooks**: For reusable logic (useAsync, useForm)
- **No Redux/Context**: Keep it simple for now

### Styling

**Framework**: Tailwind CSS v4
- Utility-first approach
- Responsive classes: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`
- Dark mode: `dark:` prefix (if configured)
- Custom CSS in `index.css` for global styles

**Naming**: Prefer component classes over utility bloat; keep `className` strings under 80 chars.

## API Conventions

### Request Format

- **Query Parameters**: snake_case (`device_type`, `page_number`)
- **Request Body**: JSON or FormData (snake_case)
- **Headers**: Standard (`Content-Type`, `Authorization` if needed)

### Response Format

```typescript
// Success (2xx)
{
  id: string,
  name: string,
  store_id: string,
  // ... snake_case fields
}

// Error (4xx/5xx)
{
  error: string // Human-readable message
}
```

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | GET /api/devices |
| 201 | Created | POST /api/devices |
| 400 | Bad Request | Missing required field |
| 404 | Not Found | Device ID doesn't exist |
| 500 | Server Error | Database connection failed |

## Testing Standards (Future)

- **Framework**: Vitest (preferred) or Jest
- **Pattern**: Unit tests for utils, integration tests for routes
- **Coverage**: Aim for 70%+ on critical paths
- **Naming**: `{module}.test.ts` or `{module}.spec.ts`

## Git & Commit Standards

### Branch Naming

- `feat/<slug>` — New feature
- `fix/<slug>` — Bug fix
- `chore/<slug>` — Maintenance, config
- `docs/<slug>` — Documentation

Example: `feat/attachment-ui-overhaul`

### Commit Messages

Use conventional commits:
```
feat: add S3 attachment uploads to device routes

- Multipart form handling with multer.fields()
- Primary image + attachments array support
- S3 file upload with path structure devices/{id}/{attachmentId}.ext
- Attachment records in database

Fixes #42
```

Format: `{type}: {short description}\n\n{detailed body}`

### Pre-Commit Checklist

- [ ] No merge conflicts
- [ ] TypeScript: `tsc --noEmit` passes (backend + frontend)
- [ ] Lint: ESLint passes (if configured)
- [ ] No console.debug, console.warn without context
- [ ] No hardcoded secrets

## Documentation Standards

- **README**: Updated for major features
- **API Docs**: OpenAPI spec (future) or inline comments
- **Code Comments**: Explain *why*, not *what*; code should be self-documenting
- **Type Definitions**: Exported at module top level

Bad comment:
```typescript
// Set device id
deviceId = uuidv4();
```

Good comment:
```typescript
// Generate UUIDv4 for device identifier to avoid collisions in distributed system
deviceId = uuidv4();
```

## Performance Best Practices

### Database

- Limit query includes to needed relations only
- Use `where` filters in include/select (not post-query filtering)
- Batch operations with `createMany` when possible

### Frontend

- Lazy load routes via React Router
- Memoize expensive computations (`useMemo`)
- Debounce API calls on search/filter inputs
- Cache stable data (locations, device types)

### File Uploads

- Validate MIME types on client + server (defense in depth)
- Show upload progress to user
- Retry failed uploads with exponential backoff

## Security Best Practices

### Input Validation

- Validate all user inputs (type, length, format)
- Sanitize file names (remove special chars)
- Validate MIME types against whitelist

### Secrets Management

- Never commit `.env` files
- Use `.env.example` for template
- Reference secrets only in server-side code
- Prisma client never exposes secrets

### File Handling

- Limit file size to 10 MB
- Whitelist MIME types
- Store files in S3 (not filesystem)
- Generate presigned URLs for temporary access

## Code Review Checklist

- [ ] Follows naming conventions
- [ ] No file >200 LOC (or justified)
- [ ] Error handling present + logged
- [ ] TypeScript strict mode compliant
- [ ] No debug statements
- [ ] New code has types (no `any`)
- [ ] Comments explain *why*
- [ ] Related docs updated

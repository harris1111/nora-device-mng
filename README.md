# Nora Device Manager

Device management web app with QR code generation, printing, S3 file attachments, and maintenance tracking.

## Features

- CRUD devices with image upload and S3 file attachments
- Auto-generated QR codes linking to public device pages
- Print QR codes per device
- Location management for device organization
- Device status tracking (active, maintenance, disposed, lost, transferred)
- Maintenance history with file attachments
- Responsive device list with grid/table view toggle
- Public page showing device info when QR is scanned

## Tech Stack

- **Backend**: Node.js + Express + Prisma 7 + PostgreSQL (TypeScript, ESM)
- **Frontend**: React 18 + Vite + Tailwind CSS v4 (TypeScript)
- **Storage**: S3-compatible object storage (iDrive e2, MinIO, AWS S3)
- **Runtime**: tsx for backend TypeScript execution
- **Deployment**: Docker Compose (multi-stage build, pnpm@9)

## Quick Start (Docker)

```bash
# 1. Create .env from example
cp .env.example .env
# 2. Fill in S3 credentials and adjust BASE_URL
# 3. Build and start
docker compose up --build -d
# App available at http://localhost:13000
```

> **Note**: The S3 bucket must be pre-created in your S3 provider console before starting the app.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://nora:nora@postgres:5432/nora_devices` | PostgreSQL connection |
| `PORT` | `13000` (host) / `3000` (container) | Server port |
| `BASE_URL` | `http://localhost:13000` | Base URL encoded in QR codes |
| `S3_ENDPOINT` | — | S3-compatible endpoint URL |
| `S3_ACCESS_KEY` | — | S3 access key ID |
| `S3_SECRET_KEY` | — | S3 secret access key |
| `S3_BUCKET` | `nora-devices` | S3 bucket name |
| `S3_REGION` | `us-east-1` | S3 region code |
| `JWT_SECRET` | — | **Required.** Secret key for JWT signing (min 32 chars) |
| `SADMIN_USERNAME` | — | **Required for seed.** Super-admin username |
| `SADMIN_PASSWORD` | — | **Required for seed.** Super-admin password |

Set `BASE_URL` to your external URL so QR codes resolve correctly:

```bash
BASE_URL=https://devices.example.com docker compose up --build -d
```

## Development

```bash
# Backend
cd backend && pnpm install && pnpm run dev   # tsx watch on :3000

# Frontend (separate terminal)
cd frontend && pnpm install && pnpm run dev  # Vite on :5173, proxies to :3000

# Type checking
cd backend && pnpm run build                 # tsc --noEmit
cd frontend && npx tsc --noEmit              # Frontend type check
```

## API Endpoints

### Devices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices` | List all devices |
| GET | `/api/devices/:id` | Get device detail |
| POST | `/api/devices` | Create device (multipart, snake_case fields) |
| PUT | `/api/devices/:id` | Update device (multipart, snake_case fields) |
| DELETE | `/api/devices/:id` | Delete device |
| GET | `/api/devices/:id/qrcode` | Serve QR code PNG |

### Locations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/locations` | List all locations |
| POST | `/api/locations` | Create location |
| PUT | `/api/locations/:id` | Update location |
| DELETE | `/api/locations/:id` | Delete location |

### Attachments (S3)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices/:deviceId/attachments` | List device attachments |
| POST | `/api/devices/:deviceId/attachments` | Upload attachments (multipart, max 10/device) |
| GET | `/api/attachments/:id/file` | Stream file from S3 |
| PUT | `/api/attachments/:id/primary` | Set attachment as primary |
| DELETE | `/api/attachments/:id` | Delete attachment |

### Maintenance Records
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices/:deviceId/maintenance` | List maintenance records |
| POST | `/api/devices/:deviceId/maintenance` | Create record (multipart) |
| DELETE | `/api/maintenance/:id` | Delete record |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/public/device/:id` | Public device info (QR target) |
| GET | `/api/health` | Health check |

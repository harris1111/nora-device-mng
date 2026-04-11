# Copilot Instructions — Nora Device Manager

## Project Overview

Device management web app with QR code generation and printing. Monorepo with separate `backend/` and `frontend/` directories.

## Tech Stack

- **Backend**: Node.js + Express + Prisma 7 + PostgreSQL (ESM, `"type": "module"`)
- **Frontend**: React 18 + Vite + Tailwind CSS v4 + React Router v6
- **Language**: TypeScript (strict mode, tsx runtime for backend)
- **Deployment**: Docker Compose (multi-stage build)
- **Storage**: S3-compatible object storage for file attachments

## Project Structure

```
backend/
  tsconfig.json            # TypeScript config (strict, ES2022, bundler)
  prisma/
    schema.prisma          # Database schema
    seed.ts                # Seed script
  src/
    index.ts               # Express server entry point
    lib/
      prisma-client.ts     # Prisma client singleton
      s3-client.ts         # S3 file operations
    routes/
      device-routes.ts     # CRUD /api/devices
      location-routes.ts   # Location endpoints
      public-routes.ts     # Public device info
      attachment-routes.ts # File attachment endpoints
      maintenance-routes.ts # Maintenance record endpoints
    utils/
      qrcode-generator.ts  # QR code generation
      response-mapper.ts   # Prisma → API response mapping
      device-status-rules.ts # Status validation logic
      s3-config-validator.ts # S3 config validation
    types/
      uuid.d.ts            # UUID type declaration
    generated/
      prisma/              # Generated Prisma client (auto-generated)
frontend/
  tsconfig.json            # TypeScript config (strict, react-jsx)
  src/
    main.tsx               # React entry point
    App.tsx                # Router config
    api/
      device-api.ts        # Axios API client with typed interfaces
    components/            # Reusable UI components (.tsx)
    pages/                 # Route pages (.tsx)
docker-compose.yml
Dockerfile
```

## Development Commands

```bash
# Backend
cd backend && pnpm install && pnpm run dev   # tsx watch on :3000

# Frontend
cd frontend && pnpm install && pnpm run dev  # Vite on :5173, proxies to :3000

# Type checking
cd backend && pnpm run build     # tsc --noEmit
cd frontend && npx tsc --noEmit  # Frontend type check

# Docker
docker compose up --build -d               # Production on :13000
```

## Key Conventions

- **File naming**: kebab-case for all files (`device-card.tsx`, `device-routes.ts`)
- **Backend**: ESM imports, Express routes in `src/routes/`, utilities in `src/utils/`, TypeScript strict mode
- **Frontend**: Functional React components with typed props, pages in `src/pages/`, components in `src/components/`
- **API client**: Centralized in `frontend/src/api/device-api.ts` using Axios with typed interfaces
- **Database**: PostgreSQL via Prisma 7, schema in `prisma/schema.prisma`
- **File storage**: S3-compatible via `@aws-sdk/client-s3`
- **Runtime**: `tsx` for backend TypeScript execution (no compile step needed)
- **No test framework configured** — add tests as needed

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

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://nora:nora@postgres:5432/nora_devices` | PostgreSQL connection string |
| `PORT` | `3000` (container), `13000` (host) | Server port |
| `BASE_URL` | `http://localhost:13000` | Base URL for QR codes |
| `S3_ENDPOINT` | — | S3-compatible endpoint URL |
| `S3_ACCESS_KEY` | — | S3 access key ID |
| `S3_SECRET_KEY` | — | S3 secret access key |
| `S3_BUCKET` | `nora-devices` | S3 bucket name |
| `S3_REGION` | `us-east-1` | S3 region code |

## Code Style Guidelines

- Use `const`/`let`, never `var`
- Prefer async/await over raw promises
- Use descriptive variable and function names
- Keep files under 200 lines — split into modules when exceeding
- Error handling: try/catch in route handlers, return appropriate HTTP status codes
- Frontend: functional components with hooks, no class components

## Git Workflow

When implementing a plan, feature, or fix:

1. **Branch**: Create from `main` — `feat/<slug>`, `fix/<slug>`, or `chore/<slug>`
2. **Implement**: Make changes, test locally
3. **Push**: Push branch to remote
4. **PR**: Create pull request
5. **Merge**: Merge after review

Commit messages use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`

## Principles

- **YAGNI**: Don't add features until needed
- **KISS**: Simplest solution that works
- **DRY**: Extract shared logic into utilities/components

## Deployment

### Docker Compose (Production)

```bash
# 1. Create .env from example
cp .env.example .env
# 2. Fill in S3 credentials and adjust BASE_URL
# 3. Build and start
docker compose up --build -d
# App available at http://localhost:13000
```

The Dockerfile uses a multi-stage build:
- **Stage 1**: Builds frontend with Vite (pnpm@9 on Alpine)
- **Stage 2**: Installs backend deps, generates Prisma client, strips `@ts-nocheck` from generated files, runs as non-root user
- **CMD**: `prisma db push --skip-generate` (auto-creates/syncs tables) → `tsx src/index.ts`

### Key Deployment Notes

- `.dockerignore` must include `**/node_modules` (not just `node_modules`) to prevent platform-specific native binaries from being copied into the Alpine container
- Prisma 7 uses `prisma db push` instead of `prisma migrate deploy` because this project has no migration files — schema is pushed directly
- The S3 bucket must be pre-created; the app does not auto-create it
- PostgreSQL data is persisted via the `pg-data` Docker volume

## Known Pitfalls & Troubleshooting

Lessons learned from development and deployment sessions:

### Prisma 7
- **`@ts-nocheck` in generated files**: Prisma 7 generates TypeScript files with `@ts-nocheck` which breaks type inference for `include` relations. After every `prisma generate`, strip it: `find src/generated -name '*.ts' -exec sed -i '/@ts-nocheck/d' {} +` (Dockerfile does this automatically)
- **Adapter required**: Prisma 7 `prisma-client` generator does NOT auto-read `DATABASE_URL`. You must use an explicit adapter (`@prisma/adapter-pg`) in `prisma-client.ts`
- **No migration files**: This project uses `prisma db push` instead of migrations. If you see `TableDoesNotExist` errors, run `npx prisma db push` inside the container
- **PrismaClient constructor typing**: May need `// @ts-expect-error` for constructor options in strict mode

### Docker / Alpine
- **pnpm lockfile cross-platform**: Windows `pnpm-lock.yaml` locks platform-specific optional deps (e.g., `@rollup/rollup-win32-x64-msvc`). Alpine needs `@rollup/rollup-linux-x64-musl`. Use `pnpm install` (not `--frozen-lockfile`) in Dockerfile, and ensure `**/node_modules` is in `.dockerignore`
- **pnpm version**: Pinned to pnpm@9 in Dockerfile to avoid pnpm@10 `approve-builds` requirement for native optional deps

### TypeScript
- **Express 5 types**: `@types/express@5` returns `string | string[]` for `req.params.*`. Cast with `as string` in all route handlers
- **uuid types**: `uuid@10` has no built-in types; `@types/uuid@11` is a stub. Custom declaration in `src/types/uuid.d.ts`
- **multer fileFilter callback**: Typing `cb(new Error(...), false)` requires `as unknown as null` cast
- **Backend ESM imports**: Must use `.js` extension in imports even for `.ts` files (required by ESM + tsx/bundler resolution)

### S3 Storage
- **Bucket must exist**: App does not create the bucket. Pre-create it in your S3 provider console
- **Bucket name**: Verify the exact bucket name in your S3 provider — check with `ListBucketsCommand` if getting `AccessDenied`
- **`forcePathStyle: true`**: Required for most S3-compatible providers (iDrive e2, MinIO, etc.)
- **Allowed file types**: Attachments restricted to `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `application/pdf`

## Sync Rule

**`.github/copilot-instructions.md`** and **`CLAUDE.md`** must stay in sync. When you modify one, apply the same changes to the other. They share the same project context — only agent-specific sections may differ.

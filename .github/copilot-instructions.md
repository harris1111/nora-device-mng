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

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices` | List all devices |
| GET | `/api/devices/:id` | Get device detail |
| POST | `/api/devices` | Create device (multipart) |
| PUT | `/api/devices/:id` | Update device (multipart) |
| DELETE | `/api/devices/:id` | Delete device |
| GET | `/api/devices/:id/image` | Serve device image |
| GET | `/api/devices/:id/qrcode` | Serve QR code PNG |
| GET | `/api/public/device/:id` | Public device info |
| GET | `/api/health` | Health check |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` (container), `13000` (host) | Server port |
| `BASE_URL` | `http://localhost:13000` | Base URL for QR codes |

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

## Sync Rule

**`.github/copilot-instructions.md`** and **`CLAUDE.md`** must stay in sync. When you modify one, apply the same changes to the other. They share the same project context — only agent-specific sections may differ.

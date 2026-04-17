# CLAUDE.md — Nora Device Manager

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
      device-routes.ts     # CRUD /api/devices (multipart: primary_image + attachments)
      location-routes.ts   # Location endpoints
      public-routes.ts     # Public device info
      attachment-routes.ts # File attachment endpoints
      maintenance-routes.ts # Maintenance records (multipart file upload support)
    scripts/
      migrate-images-to-s3.ts # One-time migration: DB images → S3 (April 2026)
    utils/
      qrcode-generator.ts  # QR code generation
      response-mapper.ts   # Prisma → API response mapping (removed image_mime)
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
      device-api.ts        # Axios API client with typed interfaces (MaintenanceAttachmentItem added)
    components/
      attachment-list.tsx  # Reusable attachment table UI (ADDED April 2026)
      pdf-viewer-modal.tsx # Inline PDF viewer modal (ADDED April 2026)
      device-form.tsx      # Device form with primary_image + attachments pickers
      maintenance-history.tsx # Maintenance records table (technician replaces performed_by)
      other components/    # Other reusable UI components (.tsx)
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
| POST | `/api/devices/:deviceId/maintenance` | Create record (multipart: date, description, technician, status, files[]) |
| DELETE | `/api/maintenance/:id` | Delete record |

### Transfer Records
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/devices/:deviceId/transfer/attachments` | Upload transfer attachments (multipart, max 5/transfer) |
| GET | `/api/transfer-attachments/:id/file` | Stream transfer attachment from S3 |
| DELETE | `/api/transfer-attachments/:id` | Delete transfer attachment |

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
| `JWT_SECRET` | — | **Required.** Secret key for JWT signing (min 32 chars) |
| `SADMIN_USERNAME` | — | **Required for seed.** Super-admin username |
| `SADMIN_PASSWORD` | — | **Required for seed.** Super-admin password |

## Attachment System (April 2026 Overhaul)

### Schema Changes
- **Removed** from Device: `image Bytes?`, `imageMime String?`
- **New** Attachment model: Stores S3 references with `isPrimary` flag (one per device)
- **New** MaintenanceAttachment model: Stores file metadata for maintenance records

### File Upload Pattern
- **Device create/update**: `multer.fields([{name: 'primary_image', maxCount: 1}, {name: 'attachments', maxCount: 9}])`
- **Maintenance create**: `multer.array('files', 5)`
- **S3 paths**: `devices/{deviceId}/{attachmentId}{ext}` | `maintenance/{recordId}/{attachmentId}{ext}`
- **Migration**: Run `backend/src/scripts/migrate-images-to-s3.ts` to migrate legacy DB images

### Frontend Components
- **AttachmentList**: Reusable table component for device/maintenance attachments with view/download/delete actions
- **PdfViewerModal**: Embedded PDF viewer using iframe (presigned URL)
- **Removed**: `attachment-gallery.tsx` (deprecated, replaced by AttachmentList)

## Git Workflow

When implementing a plan, feature, or fix:

1. **Branch**: Create from `main` — `feat/<slug>`, `fix/<slug>`, or `chore/<slug>`
2. **Implement**: Make changes, test locally
3. **Push**: Push branch to remote
4. **PR**: Create pull request via `gh pr create`
5. **Merge**: Merge via `gh pr merge` after review

Commit messages use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`

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
- **Regenerate after schema push**: After `prisma db push` changes columns, you MUST run `prisma generate` + strip `@ts-nocheck`. Otherwise the generated client queries stale columns (e.g., `ColumnNotFound` errors)

### Docker / Alpine
- **pnpm lockfile cross-platform**: Windows `pnpm-lock.yaml` locks platform-specific optional deps (e.g., `@rollup/rollup-win32-x64-msvc`). Alpine needs `@rollup/rollup-linux-x64-musl`. Use `pnpm install` (not `--frozen-lockfile`) in Dockerfile, and ensure `**/node_modules` is in `.dockerignore`
- **pnpm version**: Pinned to pnpm@9 in Dockerfile to avoid pnpm@10 `approve-builds` requirement for native optional deps
- **Postgres port mapping**: For local dev, `docker-compose.yml` exposes `5432:5432` so the backend running outside Docker can reach the DB. Without this mapping, `localhost:5432` connections fail with `ECONNREFUSED`

### TypeScript
- **Express 5 types**: `@types/express@5` returns `string | string[]` for `req.params.*`. Cast with `as string` in all route handlers
- **uuid types**: `uuid@10` has no built-in types; `@types/uuid@11` is a stub. Custom declaration in `src/types/uuid.d.ts`
- **multer fileFilter callback**: Typing `cb(new Error(...), false)` requires `as unknown as null` cast
- **Backend ESM imports**: Must use `.js` extension in imports even for `.ts` files (required by ESM + tsx/bundler resolution)
- **Dual `.env` loading**: Backend uses `import 'dotenv/config'` (loads `backend/.env` at import time for `DATABASE_URL`) then `dotenv.config({ path: '../../.env', override: false })` at runtime (loads root `.env` for S3 vars). ESM hoists all `import` statements before module-level code, so `DATABASE_URL` must be in `backend/.env`

### S3 Storage
- **Bucket must exist**: App does not create the bucket. Pre-create it in your S3 provider console
- **Bucket name**: Verify the exact bucket name in your S3 provider — check with `ListBucketsCommand` if getting `AccessDenied`
- **`forcePathStyle: true`**: Required for most S3-compatible providers (iDrive e2, MinIO, etc.)
- **Allowed file types**: Attachments restricted to `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `application/pdf`

## Sync Rule

**CLAUDE.md** and **`.github/copilot-instructions.md`** must stay in sync. When you modify one, apply the same changes to the other. They share the same project context — only agent-specific sections may differ.

## GitNexus Code Intelligence

[GitNexus](https://github.com/abhigyanpatwari/GitNexus) indexes the codebase into a knowledge graph (dependencies, call chains, clusters, execution flows) and exposes it via MCP tools so AI agents deeply understand the code.

### Setup

```bash
# Index the repo (run from repo root)
npx gitnexus analyze

# Force full re-index after major changes
npx gitnexus analyze --force

# Check index status
npx gitnexus status
```

MCP config (`.mcp.json` or global):

```json
{
  "mcpServers": {
    "gitnexus": {
      "command": "npx",
      "args": ["-y", "gitnexus@latest", "mcp"]
    }
  }
}
```

### When to Use

- **Before refactoring**: Run `impact` to check blast radius of changes
- **Before editing shared code**: Run `context` to see all callers/dependents of a symbol
- **Debugging call chains**: Use `query` to trace execution flows across files
- **Pre-commit safety**: Run `detect_changes` to map changed lines to affected processes
- **Multi-file renames**: Use `rename` for graph-aware coordinated renames
- **Architecture exploration**: Use `cypher` for raw graph queries

### Key MCP Tools

| Tool | Purpose |
|------|--------|
| `query` | Process-grouped hybrid search (BM25 + semantic) |
| `context` | 360-degree symbol view — callers, callees, processes |
| `impact` | Blast radius analysis with depth grouping and confidence |
| `detect_changes` | Git-diff → affected processes and risk level |
| `rename` | Multi-file coordinated rename via graph + text search |
| `cypher` | Raw Cypher graph queries against the knowledge graph |
| `list_repos` | Discover all indexed repositories |

### Rules

- **Re-index after schema changes**: Run `npx gitnexus analyze` after modifying `schema.prisma` or adding new route files
- **Use `impact` before editing shared utilities**: Files like `response-mapper.ts`, `prisma-client.ts`, and `device-api.ts` are high-fan-out — always check blast radius
- **Prefer `context` over grep for symbol lookups**: GitNexus resolves actual call relationships, not just text matches
- **Index is stored in `.gitnexus/`** (gitignored) — never commit it
- **One MCP server serves all indexed repos** — no per-project config needed after initial setup

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **nora-device-mng** (711 symbols, 930 relationships, 4 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/nora-device-mng/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/nora-device-mng/context` | Codebase overview, check index freshness |
| `gitnexus://repo/nora-device-mng/clusters` | All functional areas |
| `gitnexus://repo/nora-device-mng/processes` | All execution flows |
| `gitnexus://repo/nora-device-mng/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

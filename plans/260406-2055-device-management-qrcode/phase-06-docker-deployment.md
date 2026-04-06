# Phase 6: Docker & Deployment

## Context Links
- [Plan Overview](plan.md)
- [Phase 1: Project Setup](phase-01-project-setup.md)

## Overview
- **Priority**: P2
- **Status**: Pending
- **Effort**: 1h
- **Blocked by**: Phase 1 (structure), Phase 5 (full app complete)
- **Description**: Create multi-stage Dockerfile that builds frontend and serves everything from Express. Docker Compose with volume for SQLite persistence.

## Key Insights
- Multi-stage build: Stage 1 builds React app, Stage 2 runs Express serving both API and static files
- SQLite DB file must persist across container restarts → Docker volume mount
- Express serves built frontend as static files in production (no separate frontend server)
- `BASE_URL` env var needed for QR code generation — must match external access URL
- Health check endpoint already exists from Phase 1

## Requirements

### Functional
- Single `docker compose up` starts entire application
- Frontend accessible at configured port
- API and frontend served from same origin (no CORS in production)
- SQLite data persists across container restarts

### Non-functional
- Image size optimized (multi-stage build, alpine base)
- Container runs as non-root user
- Graceful shutdown handling

## Architecture

### Docker Build Flow
```
Stage 1: frontend-build (node:20-alpine)
  → Copy frontend/ → npm install → npm run build → /app/frontend/dist/

Stage 2: production (node:20-alpine)
  → Copy backend/ → npm install --production
  → Copy frontend/dist from Stage 1
  → Express serves:
      /api/*         → API routes
      /public/*      → Public routes (API)
      /*             → Static files (React SPA)
```

### Production Express Static Serving
```javascript
// In index.js (production mode):
app.use(express.static(path.join(__dirname, '..', 'frontend-dist')));

// SPA fallback — serve index.html for non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend-dist', 'index.html'));
});
```

## Related Code Files

### Files to Create
```
Dockerfile
docker-compose.yml
.dockerignore
```

### Files to Modify
```
backend/src/index.js  (add static file serving for production)
```

## Implementation Steps

### 1. Create Dockerfile

```dockerfile
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./
RUN npm ci --production

# Copy backend source
COPY backend/src ./src

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./frontend-dist

# Create data directory for SQLite
RUN mkdir -p data

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "src/index.js"]
```

### 2. Create docker-compose.yml

```yaml
services:
  app:
    build: .
    ports:
      - "${PORT:-3000}:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - BASE_URL=${BASE_URL:-http://localhost:3000}
    volumes:
      - device-data:/app/data
    restart: unless-stopped

volumes:
  device-data:
```

### 3. Create .dockerignore

```
node_modules
.git
*.md
backend/data/*.db
frontend/dist
.env
```

### 4. Update Backend for Production Static Serving

Add to `backend/src/index.js` after API routes:
```javascript
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '..', 'frontend-dist');
  app.use(express.static(frontendPath));

  // SPA fallback — all non-API routes serve index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}
```

### 5. Test Docker Build

```bash
docker compose build
docker compose up -d
# Verify: http://localhost:3000 serves React app
# Verify: http://localhost:3000/api/health returns JSON
# Verify: Create a device, restart container, data persists
docker compose down && docker compose up -d
# Check device still exists
```

## Todo List

- [ ] Create `Dockerfile` with multi-stage build
- [ ] Create `docker-compose.yml` with volume mount
- [ ] Create `.dockerignore`
- [ ] Add production static serving to `index.js`
- [ ] Add SPA fallback route (serve index.html for non-API paths)
- [ ] Build and test Docker image
- [ ] Verify data persistence across container restarts
- [ ] Verify BASE_URL env var works for QR generation
- [ ] Test health check endpoint in container

## Success Criteria
- `docker compose up --build` starts app successfully
- Frontend loads at `http://localhost:3000`
- API works at `http://localhost:3000/api/devices`
- Creating a device, restarting container → device still exists
- QR code encodes correct BASE_URL
- Health check passes

## Risk Assessment
- **better-sqlite3 native build in Alpine**: May need `python3 make g++` build deps → install in build stage, not production stage. Use multi-stage to keep production image clean
- **Volume permissions**: Non-root user must own `/app/data` → `chown` in Dockerfile
- **BASE_URL mismatch**: If user accesses via different host than BASE_URL, QR links break → document in README

## Security Considerations
- Container runs as non-root user (`appuser`)
- No secrets in image (BASE_URL passed as env var)
- Health check uses `wget` (included in alpine) instead of exposing extra endpoints

## Rollback Plan
- `docker compose down` stops everything
- Volume persists data even if container is removed
- Previous image can be tagged before rebuild: `docker tag app:latest app:backup`

## Next Steps
→ Update README.md with setup instructions, usage guide, and deployment notes

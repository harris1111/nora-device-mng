# Phase 1: Project Setup

## Context Links
- [Plan Overview](plan.md)
- [brief.txt](../../brief.txt)

## Overview
- **Priority**: P1 (blocker for all other phases)
- **Status**: Pending
- **Effort**: 1.5h
- **Description**: Initialize backend and frontend projects with all dependencies, configure build tooling, establish project structure

## Key Insights
- better-sqlite3 requires native build tools (node-gyp); Docker handles this cleanly
- Vite proxy config needed for dev to avoid CORS issues between frontend (5173) and backend (3000)
- Tailwind v4 uses CSS-based config, no tailwind.config.js needed

## Requirements

### Functional
- Backend Express server starts and responds to health check
- Frontend Vite dev server starts and renders a placeholder page
- Both can communicate via proxy in development

### Non-functional
- ESM modules for backend (`"type": "module"` in package.json)
- Consistent Node version (>=18)

## Related Code Files

### Files to Create
```
backend/package.json
backend/src/index.js
frontend/package.json
frontend/src/App.jsx
frontend/src/main.jsx
frontend/src/index.css
frontend/index.html
frontend/vite.config.js
.gitignore
```

## Implementation Steps

### 1. Initialize Backend

```bash
mkdir -p backend/src/routes backend/src/utils backend/data
cd backend && npm init -y
npm install express better-sqlite3 multer qrcode uuid cors
npm install -D nodemon
```

Update `backend/package.json`:
```json
{
  "name": "nora-device-mng-backend",
  "type": "module",
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node src/index.js"
  }
}
```

### 2. Create Backend Entry Point

`backend/src/index.js`:
```javascript
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 3. Initialize Frontend

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install react-router-dom axios
npm install -D @tailwindcss/vite tailwindcss
```

### 4. Configure Tailwind CSS v4

`frontend/src/index.css`:
```css
@import "tailwindcss";
```

`frontend/vite.config.js`:
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/public': 'http://localhost:3000',
    },
  },
});
```

### 5. Create .gitignore

```
node_modules/
dist/
backend/data/*.db
.env
```

### 6. Verify Setup

- `cd backend && npm run dev` → server on :3000, GET /api/health returns 200
- `cd frontend && npm run dev` → Vite on :5173, renders placeholder
- Frontend proxy: `http://localhost:5173/api/health` proxied to backend

## Todo List

- [ ] Initialize backend with npm and install dependencies
- [ ] Create Express entry point with health check
- [ ] Initialize frontend with Vite + React template
- [ ] Install frontend dependencies (react-router-dom, axios, tailwindcss)
- [ ] Configure Tailwind CSS v4
- [ ] Configure Vite proxy for /api and /public
- [ ] Create .gitignore
- [ ] Verify both servers start and communicate

## Success Criteria
- `npm run dev` works in both backend and frontend directories
- Health check endpoint returns JSON at `/api/health`
- Frontend proxies API requests to backend in dev mode
- Tailwind utility classes render correctly

## Risk Assessment
- **better-sqlite3 native build**: May fail on some systems without build tools → Docker solves for production; dev machines need python3 + C++ compiler
- **Tailwind v4 breaking changes**: Use `@import "tailwindcss"` not v3 config pattern

## Next Steps
→ Phase 2: Database setup and migrations

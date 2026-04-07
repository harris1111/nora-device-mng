---
title: "Device Management + QR Code Web App"
description: "Full-stack CRUD app for device management with QR code generation, printing, and public device pages"
status: pending
priority: P1
effort: 12h
branch: main
tags: [node, express, react, sqlite, qrcode, docker]
created: 2026-04-06
---

# Device Management + QR Code Web App

## Overview

Full-stack web application for managing devices with image upload, QR code generation, and print support. QR codes link to public pages displaying device name and ID.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Frontend | React (Vite) + Tailwind CSS |
| Database | SQLite via better-sqlite3 |
| QR Code | `qrcode` npm package |
| Image Upload | multer (multipart/form-data) |
| Deployment | Docker Compose (multi-stage) |

## Architecture

```
nora-device-mng/
├── backend/
│   ├── src/
│   │   ├── index.js                # Express entry point
│   │   ├── database.js             # SQLite setup + migrations
│   │   ├── routes/
│   │   │   ├── device-routes.js    # CRUD API
│   │   │   └── public-routes.js    # Public device page
│   │   └── utils/
│   │       └── qrcode-generator.js # QR generation helper
│   ├── package.json
│   └── data/                       # SQLite DB (Docker volume)
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── device-list-page.jsx
│   │   │   ├── device-detail-page.jsx
│   │   │   ├── device-create-page.jsx
│   │   │   ├── device-edit-page.jsx
│   │   │   └── public-device-page.jsx
│   │   └── components/
│   │       ├── device-card.jsx
│   │       ├── device-form.jsx
│   │       ├── qrcode-display.jsx
│   │       └── print-qrcode-button.jsx
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml
├── Dockerfile
└── README.md
```

## Data Flow

```
User → React SPA → REST API → SQLite
         ↓              ↓
   Image Upload    QR Generation
   (multer)        (qrcode pkg)
         ↓              ↓
      BLOB store    BLOB store
         ↓              ↓
   /api/devices/:id/image  /api/devices/:id/qrcode
         ↓
   QR scan → /public/device/:id → public page (device name + ID)
```

## Phases

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 1 | Project Setup | Pending | 1.5h | [phase-01](phase-01-project-setup.md) |
| 2 | Backend — Database & Models | Pending | 2h | [phase-02](phase-02-backend-database.md) |
| 3 | Backend — API Routes | Pending | 3h | [phase-03](phase-03-backend-api-routes.md) |
| 4 | Frontend — Core Pages | Pending | 3h | [phase-04](phase-04-frontend-core-pages.md) |
| 5 | Frontend — QR Code & Print | Pending | 1.5h | [phase-05](phase-05-frontend-qrcode-print.md) |
| 6 | Docker & Deployment | Pending | 1h | [phase-06](phase-06-docker-deployment.md) |

## Dependencies

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
                                              ↓
Phase 1 ──────────────────────────────→ Phase 6
```

Phase 4 and 5 can overlap once Phase 3 API is stable. Phase 6 can start after Phase 1 scaffolding but final config needs all phases done.

## Key Decisions

- **Images as BLOBs**: Simpler than filesystem storage; SQLite handles well under ~5MB per image
- **QR stored at creation**: Generated once, stored as PNG BLOB. Avoids regeneration overhead
- **No auth**: Per requirements, all pages are public
- **UUID v4 for device IDs**: Prevents sequential ID guessing on public URLs
- **Single Dockerfile**: Multi-stage build — frontend built in Node stage, served by Express in production

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Large images bloat SQLite | Medium | Medium | Multer 5MB limit, frontend validation |
| QR URLs break if host changes | Low | High | Store QR content (URL) in DB, add regeneration endpoint |
| Print CSS inconsistency across browsers | Medium | Low | Test Chrome + Firefox, keep print layout minimal |
| SQLite write contention | Low | Low | Single-user app, better-sqlite3 is synchronous |

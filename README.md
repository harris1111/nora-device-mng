# Nora Device Manager

Device management web app with QR code generation and printing.

## Features

- CRUD devices with image upload
- Auto-generated QR codes linking to public device pages
- Print QR codes per device
- Responsive device list with grid layout
- Public page showing device name + ID when QR is scanned

## Tech Stack

- **Backend**: Node.js + Express + better-sqlite3
- **Frontend**: React + Vite + Tailwind CSS v4
- **Deployment**: Docker Compose

## Quick Start (Docker)

```bash
docker compose up --build -d
```

App available at `http://localhost:3000`.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Host port mapping |
| `BASE_URL` | `http://localhost:3000` | Base URL encoded in QR codes |

Set `BASE_URL` to your external URL so QR codes resolve correctly:

```bash
BASE_URL=https://devices.example.com docker compose up --build -d
```

## Development

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

Frontend dev server runs on `:5173` with proxy to backend `:3000`.

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

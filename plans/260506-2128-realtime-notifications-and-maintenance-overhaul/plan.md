---
name: brief4-realtime-notifications-and-maintenance-overhaul
status: in_progress
created: 2026-05-06
branch: dev2
---

# Brief 4 — Realtime Notifications + Maintenance Overhaul

Source: `Brief (4).txt`

## Tasks delivered

1. **Realtime notifications**
   - `Notification` table (per-user, dedupe via `source_type`/`source_id`)
   - In-process SSE hub (`notification-hub.ts`) — keeps live `Response` set per user
   - REST: `GET /api/notifications`, `PATCH /:id/read`, `POST /mark-all-read`
   - Stream: `GET /api/notifications/stream` (SSE, cookie auth via same-origin)
   - Frontend `NotificationBell` with EventSource client, unread badge, mark-read on click

2. **Maintenance feature (separate from "repair history")**
   - `ScheduledMaintenance`: per-device `interval_days`, `notify_days_before`, `next_due_at`, `last_notified_at` (dedupe)
   - `MaintenanceTask` + `MaintenanceTaskAttachment`: same shape as repair records, distinct table
   - `Device.maintenance_status` ∈ `'in_use' | 'needs_maintenance'`
   - Backend scheduler (`maintenance-scheduler.ts`) — `setInterval(5 min)` polling: when `next_due_at - notify_days_before <= now` AND `last_notified_at IS NULL`, fan out a notification to admins, set device to `needs_maintenance`, mark `last_notified_at`. Re-notify suppressed until `lastNotifiedAt` reset.
   - Completing a task with `status='completed'` advances `next_due_at` by `interval_days`, clears `last_notified_at`, resets device → `in_use`.
   - Frontend `MaintenanceSection`: schedule editor + task list with **week/month/year** filter

3. **Rename "Lịch sử bảo trì" → "Lịch sử sửa chữa"** (UI labels only, schema/code names preserved to avoid data migration).

## Architecture notes

- SSE chosen over WebSocket: simpler, one-way fits use case, native EventSource, cookie auth piggybacks.
- Scheduler is in-process — fine for single-instance docker-compose deployment. Multi-instance would need leader election or external job queue.
- Notification fan-out is per-user (one row per recipient) — read state stays per-user.

## Files

### Backend (new/modified)
- `prisma/schema.prisma` (+ ScheduledMaintenance, MaintenanceTask, MaintenanceTaskAttachment, Notification, Device.maintenance_status)
- `src/lib/notification-hub.ts` (NEW)
- `src/lib/notification-service.ts` (NEW)
- `src/lib/maintenance-scheduler.ts` (NEW)
- `src/routes/maintenance-schedule-routes.ts` (NEW)
- `src/routes/maintenance-task-routes.ts` (NEW)
- `src/routes/notification-routes.ts` (NEW)
- `src/index.ts` (route mount + scheduler boot)

### Frontend (new/modified)
- `src/api/device-api.ts` (types + fetchers for schedules, tasks, notifications)
- `src/components/notification/notification-bell.tsx` (NEW)
- `src/components/maintenance/maintenance-section.tsx` (NEW)
- `src/components/layout/app-layout.tsx` (bell wired into desktop + mobile headers)
- `src/components/maintenance/maintenance-history.tsx` (relabel only)
- `src/pages/device-detail-page.tsx` (mount MaintenanceSection, relabel)
- `src/pages/public-device-page.tsx` (relabel)

## Validation

- backend tsc clean
- frontend tsc clean
- vite production build clean

## Unresolved / follow-ups

- Maintenance permission key reused (`maintenance` module) for both task and schedule routes — no schema seed change required. If future split into separate modules is wanted, update `seed.ts` and `permissions` table.
- Scheduler poll cadence (5 min) is hard-coded; expose as env var if ops need to tune.
- No backfill of existing devices' `maintenance_status` — defaults to `'in_use'` via column default; existing rows get the default on `prisma db push`.
- Reminder notifications fan out to all SADMIN/ADMIN users only. USER role does not receive maintenance reminders (RBAC: USER has no `maintenance` permissions today).
- No e2e harness; functional testing requires running the docker stack.

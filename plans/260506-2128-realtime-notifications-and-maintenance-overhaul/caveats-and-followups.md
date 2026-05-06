# Brief 4 — Caveats & Follow-ups

Captured 2026-05-06 after the realtime-notifications + maintenance-overhaul commit (`7eb8a9f`).

## Deployment

- **`prisma db push` required.** New tables: `scheduled_maintenances`, `maintenance_tasks`, `maintenance_task_attachments`, `notifications`. New column: `devices.maintenance_status` (default `'in_use'` — existing rows pick up the default).
- The Dockerfile entrypoint already runs `prisma db push --skip-generate`, so a `docker compose up --build -d` applies the changes automatically. For local dev outside Docker, run `npx prisma db push` from `backend/`.
- After push, restart backend so the in-process maintenance scheduler picks up the new schedules.

## Naming / data preservation

- "Lịch sử bảo trì" → "Lịch sử sửa chữa" is **UI label only**. Underlying Prisma models (`MaintenanceRecord`, `MaintenanceAttachment`) and tables (`maintenance_records`, `maintenance_attachments`) keep original names so existing data is not migrated/destroyed.
- New maintenance feature lives in distinct tables (`maintenance_tasks`, `maintenance_task_attachments`) — clean separation, zero risk to existing rows.

## Architecture limits

- **Scheduler is in-process** (`setInterval`, 5 min). Fine for single-instance docker-compose deployment; multi-instance would re-fire the same notifications. Mitigations if scaling out: leader election, external cron, or BullMQ/Redis-backed queue.
- **SSE hub is in-process** — clients connected to instance A won't receive events broadcast from instance B. Same fix path.
- Poll cadence is hard-coded at 5 minutes. Expose as env var (`MAINTENANCE_POLL_MS`) if ops needs to tune.

## RBAC

- Reminder notifications fan out to **SADMIN + ADMIN** only (USER role has no `maintenance` permission today).
- Maintenance permission key is reused (`maintenance` module) for both schedule and task routes — no `permissions` table change required.

## Behavior details to confirm

- Completing a `MaintenanceTask` with `status='completed'` advances `ScheduledMaintenance.next_due_at` by `interval_days` and clears `last_notified_at`. Editing an already-completed task to a different completion date will re-advance — intentional.
- Setting/changing a schedule resets device → `in_use`. Deleting the schedule also resets to `in_use`.
- `last_notified_at` is the dedupe key — once set for the current cycle, no further reminders fire until the cycle is reset (by completion or schedule change).

## Open follow-ups

- Add a "Mark device back in use" manual action without requiring a completed task (operator override).
- Notification preferences UI (mute by source, opt-in/out per type).
- Backfill task attachments on detail page so users can add files post-creation (already supported via `POST /api/maintenance-tasks/:id/attachments`, just no UI button yet).
- Sound/desktop notification on bell — current bell is silent.
- E2E test harness — none in repo; functional verification still requires manual testing on a running stack.
- Excel export not yet aware of `maintenance_status` or warranty fields.

---
title: "RBAC + Authentication System"
description: "Add JWT cookie auth, role-based permissions (SAdmin/Admin/User), user management, permission dashboard, audit log across backend + frontend"
status: pending
priority: P0
effort: 40h
branch: feat/rbac-auth-system
tags: [auth, rbac, jwt, security, permissions, audit]
created: 2026-04-15
---

## Overview

Add complete RBAC system to Nora Device Manager. Currently zero auth — all routes are public. Target: JWT cookie auth with 3 roles (SAdmin/Admin/User), per-role permission matrix on 7 business modules, user management, permission dashboard, audit logging.

## Architecture: Current vs Target

```
CURRENT:  Browser → Express routes → Prisma → DB (no auth)
TARGET:   Browser → [cookie JWT] → require-auth → require-permission(module,action) → route → Prisma → DB
          Login:  POST /api/auth/login → verify bcrypt → sign JWT → set httpOnly cookie
          Guard:  Cookie → verify JWT → load Permission(role, module) → allow/deny
```

## Key Decisions

| Decision | Choice |
|---|---|
| Auth mechanism | JWT in httpOnly cookie, SameSite=strict, HS256, 7d expiry |
| Permission model | `(role, module) → {can_view, can_create, can_update, can_delete}` |
| Roles | SADMIN (1 only, env-seeded), ADMIN, USER |
| Bootstrap | Env vars SADMIN_USERNAME + SADMIN_PASSWORD, seeded on startup |
| Password change | Admin-only via reset (no user self-service change-password) |
| Route gating | All /api/* except /api/auth/* and /api/public/* |
| Rollout | Big-bang cutover, no feature flag |
| Audit | Table logging login, user CRUD, permission changes |
| Tracking columns | created_by/updated_by (nullable FK→User) on all business models |

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | DB Schema + Seed | Pending | 4h | [phase-01](phase-01-db-schema-and-seed.md) |
| 2 | Backend Auth Core | Pending | 6h | [phase-02](phase-02-backend-auth-core.md) |
| 3 | Gate Existing Routes | Pending | 5h | [phase-03](phase-03-gate-existing-routes.md) |
| 4 | User + Permission APIs | Pending | 6h | [phase-04](phase-04-user-and-permission-apis.md) |
| 5 | Frontend Auth + Guards | Pending | 6h | [phase-05](phase-05-frontend-auth-and-guards.md) |
| 6 | Frontend User Management | Pending | 5h | [phase-06](phase-06-frontend-user-management-pages.md) |
| 7 | Frontend Permission Dashboard | Pending | 4h | [phase-07](phase-07-frontend-permission-dashboard.md) |
| 8 | Audit Log + Polish + Docs | Pending | 4h | [phase-08](phase-08-audit-log-and-polish.md) |

## Dependencies

- Phase 2 depends on Phase 1 (User/Permission models must exist)
- Phase 3 depends on Phase 2 (middleware must exist to gate routes)
- Phase 4 depends on Phase 2 (auth middleware needed for user/permission endpoints)
- Phase 5 depends on Phase 2 (login API must work)
- Phase 6 depends on Phases 4+5 (user APIs + auth context)
- Phase 7 depends on Phases 4+5 (permission APIs + auth context)
- Phase 8 depends on all prior phases

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Prisma 7 @ts-nocheck after regenerate | High | High | Strip script in package.json + Dockerfile already handles it |
| Breaking existing API consumers | Medium | High | Big-bang requires testing all existing flows post-auth |
| Cookie not sent cross-origin in dev | Medium | Medium | Vite proxy already forwards to :3000; set CORS credentials:true |
| JWT_SECRET not set in prod | Low | Critical | Validate on startup, refuse to start if missing |

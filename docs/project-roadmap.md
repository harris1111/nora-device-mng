# Project Roadmap — Nora Device Manager

Last updated: April 12, 2026

## Current Status: v2.0 In Progress

### Phase 1: Core Infrastructure ✅ COMPLETE

**Status**: 100% — Deployed  
**Timeline**: Q1 2026

- ✅ Express backend with Prisma 7 + PostgreSQL
- ✅ React frontend with Vite + Tailwind CSS v4
- ✅ Docker Compose setup (multi-stage build)
- ✅ QR code generation + printing
- ✅ Device CRUD with location tracking
- ✅ Status management (active, maintenance, disposed, lost, transferred)

### Phase 2: S3 File Attachments ✅ COMPLETE

**Status**: 100% — Deployed (April 12, 2026)  
**Timeline**: April 2026

- ✅ S3-compatible storage integration (`@aws-sdk/client-s3`)
- ✅ Multer multipart file handling (primary + attachments)
- ✅ Device attachment upload on create/update
- ✅ Maintenance record file attachments
- ✅ S3 presigned URLs for download
- ✅ File type/size validation (whitelist + 10MB limit)

### Phase 3: Attachment UI Overhaul ✅ COMPLETE

**Status**: 100% — Deployed (April 12, 2026)  
**Timeline**: April 2026

- ✅ Removed `image` + `imageMime` from Device schema
- ✅ Migration script: database images → S3 attachments
- ✅ New `AttachmentList` component (table-based, reusable)
- ✅ New `PdfViewerModal` component (inline PDF viewing)
- ✅ `attachment-gallery.tsx` deprecated
- ✅ Device form: primary image + attachments pickers
- ✅ Maintenance history: `performed_by` → `technician`; file uploads
- ✅ Maintenance attachments table per record
- ✅ Public device page: read-only attachment list

**Deliverables**:
- Backend: `device-routes.ts`, `maintenance-routes.ts`, migration script
- Frontend: `attachment-list.tsx`, `pdf-viewer-modal.tsx`, form updates
- Documentation: codebase-summary, system-architecture, code-standards

### Phase 4: Authentication & Authorization (PLANNED)

**Status**: 0% — Planned  
**Timeline**: Q2 2026

- [ ] User registration + login
- [ ] JWT token management
- [ ] Role-based access control (Admin, Manager, Technician, Viewer)
- [ ] Device ownership constraints
- [ ] Audit logging

**Decisions**:
- Auth framework: Better Auth (TypeScript, flexible providers)
- JWT storage: HTTP-only cookies
- Roles: 4-tier system above

### Phase 5: Advanced Device Features (PLANNED)

**Status**: 0% — Planned  
**Timeline**: Q2-Q3 2026

- [ ] Batch device import (CSV)
- [ ] Bulk device operations (status change, reassign location)
- [ ] Advanced search + filters
- [ ] Device history timeline (status transitions)
- [ ] Export device data (CSV, PDF)
- [ ] Email notifications on status changes

### Phase 6: Analytics & Reporting (PLANNED)

**Status**: 0% — Planned  
**Timeline**: Q3 2026

- [ ] Device dashboard: counts by type/status/location
- [ ] Maintenance history analysis
- [ ] Device lifecycle trends
- [ ] S3 storage usage reporting
- [ ] API usage stats (if multi-tenant)

### Phase 7: Mobile Optimization (CONSIDERED)

**Status**: 0% — Backlog  
**Timeline**: Q4 2026 or later

- [ ] Mobile-responsive current UI (primary focus)
- [ ] Native mobile app (React Native or Flutter — low priority)
- [ ] QR code scanner app (integrate with device detail)

### Phase 8: DevOps & Production (PLANNED)

**Status**: 0% — Planned  
**Timeline**: Ongoing

- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Automated testing (unit + integration)
- [ ] Database backup strategy
- [ ] S3 backup/replication
- [ ] Monitoring + alerting (logs, errors)
- [ ] Staging environment

## Success Metrics

### Phase 3 (Current) ✅

- [x] All device tests pass (file upload, multipart)
- [x] All maintenance tests pass (file attachments)
- [x] AttachmentList component renders without errors
- [x] PDF viewer opens inline without external plugins
- [x] Migration script successfully moves 100% of DB images to S3
- [x] Frontend form handles primary image + multiple attachments
- [x] No regression on existing device/location/public endpoints

### Phase 4 (Next)

- [ ] Auth flows pass all security tests
- [ ] Role-based endpoints return 403 on unauthorized access
- [ ] JWT refresh strategy implemented
- [ ] OWASP top 10 security checks pass

### Ongoing

- [ ] Zero unhandled promise rejections in production
- [ ] API response time <500ms (p95)
- [ ] Uptime >99%
- [ ] Dev onboarding time <30 minutes

## Known Limitations & Future Considerations

### Technical Debt

- [ ] Add comprehensive test suite (Vitest)
- [ ] Implement request logging/tracing
- [ ] Add input rate limiting
- [ ] Implement database connection pooling
- [ ] Consider caching layer (Redis) for device list

### Architectural Decisions (Deferred)

- **Direct browser → S3 uploads**: Not yet implemented (currently backend uploads)
- **Real-time updates**: No WebSocket (could add Socket.io if needed)
- **Multi-tenancy**: Single tenant for now; schema easily supports multi-tenant
- **GraphQL API**: REST only for now; GraphQL considered but not required

### File Storage Strategy

Current: Backend upload + S3 storage (simple, works for 10MB limit)

Future considerations:
- Direct browser uploads → presigned URLs (reduce backend load)
- CDN integration (Cloudflare or similar) for faster downloads
- Image resizing/thumbnails for performance

## Dependency Roadmap

| Dependency | Current | Next |
|----------|---------|------|
| Prisma | 7.x | 7.x → 8.x (when released, if breaking changes minor) |
| Express | 5.x | 5.x → 6.x (future) |
| React | 18 | 19+ (when compatible with Vite + deps) |
| TypeScript | Latest | Latest (always update) |
| Node | 20.x | 22.x+ (LTS cycle) |

## Team & Resources

**Developers**: 1 (Founder)  
**Estimated Effort**: Phase 4 (Auth) ≈ 40 hours; Phase 5 (Advanced) ≈ 60 hours

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| S3 bucket downtime | High | Multi-region replication, fallback storage |
| Database migration fails | Medium | Test migration script thoroughly, backup before run |
| Frontend file upload timeouts | Medium | Implement client-side retry + progress UI |
| Image/PDF rendering issues | Low | Test all MIME types; provide explicit error messages |

## Approval & Sign-Off

- **Last Reviewed**: April 12, 2026
- **Approved By**: Self (Founder)
- **Next Review**: May 2026 (post-Phase 4 completion)

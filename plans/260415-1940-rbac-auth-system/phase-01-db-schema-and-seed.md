# Phase 01 — DB Schema + Seed

## Context Links
- [Brief v4](../../brief-v4.txt) — sections 2, 10, 11
- [Current schema](../../backend/prisma/schema.prisma)
- [Current seed](../../backend/prisma/seed.ts)
- [Plan overview](plan.md)

## Overview
- **Priority:** P0 — all other phases depend on this
- **Status:** Pending
- **Effort:** 4h
- **Description:** Add User, Permission, AuditLog models to Prisma schema. Add created_by/updated_by FK columns to all 7 existing business models. Update seed to bootstrap SAdmin + default permission matrix.

## Key Insights
- Prisma 7 uses `prisma db push` (no migration files). After every schema change: `npx prisma generate` then strip `@ts-nocheck` from generated files.
- Existing models have NO `updatedAt` field (except User which we're creating). Don't add updatedAt to existing models — out of scope.
- SAdmin is seeded from env vars, not hardcoded. Only 1 SAdmin ever.
- Permission model uses `role` enum (not FK to User) — permissions are per-role, not per-user.

## Requirements

### Functional
- F1: User model with id, username (unique), password_hash, role enum, status enum, audit FKs, timestamps
- F2: Permission model with unique(role, module) and 4 boolean CRUD flags
- F3: AuditLog model for recording security-relevant actions
- F4: created_by/updated_by nullable FK→User on: Device, Location, MaintenanceRecord, TransferRecord, Attachment, MaintenanceAttachment, TransferAttachment
- F5: Seed SAdmin from SADMIN_USERNAME + SADMIN_PASSWORD env vars (bcrypt hash)
- F6: Seed default Permission rows for all (role, module) combinations

### Non-functional
- NF1: bcryptjs for password hashing (pure JS, no native compile issues on Alpine)
- NF2: Seed must be idempotent (upsert pattern)

## Architecture

### New Enums
```prisma
enum UserRole {
  SADMIN
  ADMIN
  USER
}

enum UserStatus {
  ACTIVE
  LOCKED
}
```

### New Models

```prisma
model User {
  id           String     @id @default(uuid())
  username     String     @unique
  passwordHash String     @map("password_hash")
  role         UserRole   @default(USER)
  status       UserStatus @default(ACTIVE)
  createdById  String?    @map("created_by")
  createdBy    User?      @relation("UserCreatedBy", fields: [createdById], references: [id])
  createdUsers User[]     @relation("UserCreatedBy")
  updatedById  String?    @map("updated_by")
  updatedBy    User?      @relation("UserUpdatedBy", fields: [updatedById], references: [id])
  updatedUsers User[]     @relation("UserUpdatedBy")
  createdAt    DateTime   @default(now()) @map("created_at")
  updatedAt    DateTime   @updatedAt @map("updated_at")

  // Reverse relations for audit columns on business models
  devicesCreated              Device[]              @relation("DeviceCreatedBy")
  devicesUpdated              Device[]              @relation("DeviceUpdatedBy")
  locationsCreated            Location[]            @relation("LocationCreatedBy")
  locationsUpdated            Location[]            @relation("LocationUpdatedBy")
  maintenanceRecordsCreated   MaintenanceRecord[]   @relation("MaintenanceCreatedBy")
  maintenanceRecordsUpdated   MaintenanceRecord[]   @relation("MaintenanceUpdatedBy")
  transferRecordsCreated      TransferRecord[]      @relation("TransferCreatedBy")
  transferRecordsUpdated      TransferRecord[]      @relation("TransferUpdatedBy")
  attachmentsCreated          Attachment[]          @relation("AttachmentCreatedBy")
  attachmentsUpdated          Attachment[]          @relation("AttachmentUpdatedBy")
  maintAttachmentsCreated     MaintenanceAttachment[] @relation("MaintAttachCreatedBy")
  maintAttachmentsUpdated     MaintenanceAttachment[] @relation("MaintAttachUpdatedBy")
  transferAttachmentsCreated  TransferAttachment[]  @relation("TransferAttachCreatedBy")
  transferAttachmentsUpdated  TransferAttachment[]  @relation("TransferAttachUpdatedBy")
  auditLogs                   AuditLog[]

  @@map("users")
}

model Permission {
  id        String   @id @default(uuid())
  role      UserRole
  module    String
  canView   Boolean  @default(false) @map("can_view")
  canCreate Boolean  @default(false) @map("can_create")
  canUpdate Boolean  @default(false) @map("can_update")
  canDelete Boolean  @default(false) @map("can_delete")

  @@unique([role, module])
  @@map("permissions")
}

model AuditLog {
  id          String   @id @default(uuid())
  actorUserId String?  @map("actor_user_id")
  actor       User?    @relation(fields: [actorUserId], references: [id], onDelete: SetNull)
  action      String                         // e.g. "login_success", "user_create", "permission_update"
  targetType  String?  @map("target_type")   // e.g. "User", "Permission"
  targetId    String?  @map("target_id")
  metadata    Json?    @db.JsonB             // arbitrary context
  ip          String?
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("audit_logs")
}
```

### Audit Columns on Existing Models

Add to each of: Device, Location, MaintenanceRecord, TransferRecord, Attachment, MaintenanceAttachment, TransferAttachment:

```prisma
createdById String? @map("created_by")
createdBy   User?   @relation("{Model}CreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
updatedById String? @map("updated_by")
updatedBy   User?   @relation("{Model}UpdatedBy", fields: [updatedById], references: [id], onDelete: SetNull)
```

Replace `{Model}` with the relation name prefix (e.g. `DeviceCreatedBy`, `LocationUpdatedBy`).

### Default Permission Matrix (seed)

Modules: `devices`, `locations`, `maintenance`, `attachments`, `transfer`, `users`, `permissions`

| Role | devices | locations | maintenance | attachments | transfer | users | permissions |
|------|---------|-----------|-------------|-------------|----------|-------|-------------|
| SADMIN | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | VU (view+update) |
| ADMIN | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD* | VU |
| USER | V--- | V--- | ---- | ---- | ---- | ---- | ---- |

*Admin `users` CRUD is enforced at API level to scope to USER-role only.
USER defaults to view-only on devices+locations; all else off. Adjustable via permission dashboard.

## Related Code Files

### Files to Modify
- `backend/prisma/schema.prisma` — add enums, 3 new models, audit columns on 7 models
- `backend/prisma/seed.ts` — add SAdmin upsert + Permission matrix seeding
- `backend/package.json` — add `bcryptjs` dependency

### Files to Create
- None (schema + seed are existing files)

### Files to Delete
- None

## Implementation Steps

1. **Install bcryptjs**
   ```bash
   cd backend && pnpm add bcryptjs && pnpm add -D @types/bcryptjs
   ```

2. **Edit `schema.prisma`** — add in this order:
   - a. Add `UserRole` and `UserStatus` enums after `datasource db`
   - b. Add `User` model with self-referential created_by/updated_by
   - c. Add `Permission` model with `@@unique([role, module])`
   - d. Add `AuditLog` model
   - e. Add `createdById`/`updatedById` fields + User relations to all 7 existing models (Device, Location, MaintenanceRecord, TransferRecord, Attachment, MaintenanceAttachment, TransferAttachment)
   - f. Add reverse relation arrays on User model for each business model

3. **Run schema push + regenerate**
   ```bash
   cd backend
   npx prisma db push
   npx prisma generate
   find src/generated -name '*.ts' -exec sed -i '/@ts-nocheck/d' {} +
   ```

4. **Edit `seed.ts`** — replace/extend with:
   - a. Import `bcryptjs`
   - b. Read `SADMIN_USERNAME` and `SADMIN_PASSWORD` from env (throw if missing)
   - c. Upsert SAdmin user: `prisma.user.upsert({ where: { username }, create: { username, passwordHash: hash, role: 'SADMIN', status: 'ACTIVE' }, update: { passwordHash: hash } })`
   - d. Upsert Permission rows for all 21 combinations (3 roles x 7 modules) using the matrix above
   - e. Keep existing location/device seed logic unchanged

5. **Run seed**
   ```bash
   cd backend && SADMIN_USERNAME=admin SADMIN_PASSWORD=admin123 pnpm run db:seed
   ```

6. **Type-check**
   ```bash
   cd backend && pnpm run build
   ```

## Todo List

- [ ] Install bcryptjs + @types/bcryptjs
- [ ] Add UserRole, UserStatus enums to schema
- [ ] Add User model to schema
- [ ] Add Permission model to schema
- [ ] Add AuditLog model to schema
- [ ] Add created_by/updated_by to Device
- [ ] Add created_by/updated_by to Location
- [ ] Add created_by/updated_by to MaintenanceRecord
- [ ] Add created_by/updated_by to TransferRecord
- [ ] Add created_by/updated_by to Attachment
- [ ] Add created_by/updated_by to MaintenanceAttachment
- [ ] Add created_by/updated_by to TransferAttachment
- [ ] Add all reverse relation arrays on User
- [ ] Run prisma db push + generate + strip @ts-nocheck
- [ ] Update seed.ts with SAdmin bootstrap
- [ ] Update seed.ts with Permission matrix
- [ ] Run seed successfully
- [ ] Type-check passes (pnpm run build)

## Success Criteria
- `prisma db push` succeeds without errors
- `pnpm run build` passes type-check
- SAdmin user exists in DB with bcrypt-hashed password
- 21 Permission rows exist (3 roles x 7 modules)
- All 7 existing models have nullable created_by/updated_by columns
- Existing data unaffected (columns are nullable)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| @ts-nocheck not stripped | High | High | Always run strip command after generate; add to package.json script |
| Self-referential User FK confuses Prisma | Low | Medium | Named relations ("UserCreatedBy"/"UserUpdatedBy") resolve ambiguity |
| Existing queries break due to new fields | Low | Low | New fields are optional; existing queries don't select them |

## Security Considerations
- Password stored as bcrypt hash only (cost factor 12)
- SADMIN_PASSWORD env var — not committed to git, document in .env.example
- AuditLog actor FK uses onDelete:SetNull so logs persist if user deleted

## Next Steps
- Phase 02 uses User + Permission models for auth middleware
- Phase 03 uses created_by/updated_by fields in route handlers

# Phase 02 — Backend Auth Core

## Context Links
- [Phase 01 — Schema](phase-01-db-schema-and-seed.md) — User/Permission models
- [Current index.ts](../../backend/src/index.ts) — Express app setup
- [Brief v4](../../brief-v4.txt) — sections 8, 11

## Overview
- **Priority:** P0 — gates all subsequent phases
- **Status:** Pending
- **Effort:** 6h
- **Description:** Implement JWT cookie auth: login, logout, me endpoints. Create auth + permission middleware. Wire cookie-parser into Express. (No self-service change-password — password changes are admin-only via reset in Phase 4.)

## Key Insights
- Express app currently uses `cors({ origin: BASE_URL })`. Must add `credentials: true` for cookie flow.
- Vite dev proxy forwards to :3000, so cookies set on :3000 are forwarded transparently — no cross-origin cookie issue in dev.
- In production, frontend is served from same origin (Express static), so SameSite=strict works.
- JWT_SECRET must be validated on startup — refuse to start if missing.
- Express 5 types: `req.params.*` returns `string | string[]`, cast with `as string`.

## Requirements

### Functional
- F1: `POST /api/auth/login` — validate username+password, set JWT httpOnly cookie, return user profile + permissions map
- F2: `POST /api/auth/logout` — clear cookie
- F3: `GET /api/auth/me` — return current user + permissions (from cookie)
- F4: `require-auth` middleware — verify JWT, reject 401 if invalid/missing, attach `req.user`
- F5: `require-permission(module, action)` middleware — check Permission table, reject 403 if denied
- F6: Log login success/fail to AuditLog

### Non-functional
- NF1: JWT expiry 7 days (configurable via JWT_EXPIRES_IN env)
- NF2: Cookie: httpOnly, sameSite='strict', secure when NODE_ENV=production, path='/'
- NF3: Locked users (status=LOCKED) rejected at login with clear message

## Architecture

### Data Flow — Login
```
POST /api/auth/login { username, password }
  → find User by username
  → if not found or LOCKED → 401 + audit log (login_fail)
  → bcrypt.compare(password, passwordHash)
  → if mismatch → 401 + audit log (login_fail)
  → sign JWT { userId, role } with JWT_SECRET, exp 7d
  → set cookie "token" with JWT
  → load Permission rows for user.role
  → return { user: { id, username, role, status }, permissions: { [module]: { view, create, update, delete } } }
  → audit log (login_success)
```

### Data Flow — Middleware Chain
```
Request → cookie-parser → require-auth → require-permission → route handler

require-auth:
  cookie "token" → jwt.verify → { userId, role }
  → prisma.user.findUnique(userId)
  → if not found or LOCKED → 401
  → req.user = { id, username, role }
  → next()

require-permission(module, action):
  → prisma.permission.findUnique({ role: req.user.role, module })
  → check can_{action} boolean
  → if false → 403 { error: "Forbidden", module, action }
  → next()
```

### JWT Payload
```ts
interface JwtPayload {
  userId: string;
  role: 'SADMIN' | 'ADMIN' | 'USER';
  iat: number;
  exp: number;
}
```

### Express Request Extension
```ts
// backend/src/types/express.d.ts
declare namespace Express {
  interface Request {
    user?: {
      id: string;
      username: string;
      role: 'SADMIN' | 'ADMIN' | 'USER';
    };
  }
}
```

## Related Code Files

### Files to Create
- `backend/src/lib/jwt-utils.ts` — signToken(payload), verifyToken(token)
- `backend/src/lib/password-utils.ts` — hashPassword(plain), comparePassword(plain, hash)
- `backend/src/middleware/require-auth.ts` — JWT cookie verification middleware
- `backend/src/middleware/require-permission.ts` — permission check middleware factory
- `backend/src/routes/auth-routes.ts` — login, logout, me
- `backend/src/types/express.d.ts` — req.user type augmentation
- `backend/src/utils/audit-logger.ts` — helper to insert AuditLog rows

### Files to Modify
- `backend/src/index.ts` — add cookie-parser, CORS credentials, auth routes, JWT_SECRET validation
- `backend/package.json` — add jsonwebtoken, cookie-parser, @types/*

### Files to Delete
- None

## Implementation Steps

1. **Install dependencies**
   ```bash
   cd backend
   pnpm add jsonwebtoken cookie-parser
   pnpm add -D @types/jsonwebtoken @types/cookie-parser
   ```

2. **Create `src/types/express.d.ts`**
   ```ts
   import { UserRole } from '../generated/prisma/index.js';

   declare global {
     namespace Express {
       interface Request {
         user?: {
           id: string;
           username: string;
           role: UserRole;
         };
       }
     }
   }
   export {};
   ```
   Also add `"include": ["src/**/*.ts", "src/types/**/*.d.ts"]` to tsconfig.json if not already covered.

3. **Create `src/lib/password-utils.ts`**
   ```ts
   import bcrypt from 'bcryptjs';
   const SALT_ROUNDS = 12;
   export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, SALT_ROUNDS);
   export const comparePassword = (plain: string, hash: string): Promise<boolean> => bcrypt.compare(plain, hash);
   ```

4. **Create `src/lib/jwt-utils.ts`**
   ```ts
   import jwt from 'jsonwebtoken';

   const SECRET = process.env.JWT_SECRET!; // validated at startup
   const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

   export interface TokenPayload { userId: string; role: string; }

   export function signToken(payload: TokenPayload): string {
     return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
   }

   export function verifyToken(token: string): TokenPayload {
     return jwt.verify(token, SECRET) as TokenPayload;
   }
   ```

5. **Create `src/utils/audit-logger.ts`**
   ```ts
   import prisma from '../lib/prisma-client.js';

   interface AuditEntry {
     actorUserId?: string | null;
     action: string;
     targetType?: string;
     targetId?: string;
     metadata?: Record<string, unknown>;
     ip?: string;
   }

   export async function logAudit(entry: AuditEntry): Promise<void> {
     try {
       await prisma.auditLog.create({ data: entry });
     } catch (err) {
       console.error('Audit log write failed:', err);
       // Non-blocking — don't crash request
     }
   }
   ```

6. **Create `src/middleware/require-auth.ts`**
   - Read `req.cookies.token`
   - Call `verifyToken(token)` — catch error → 401
   - `prisma.user.findUnique({ where: { id: payload.userId } })`
   - If not found or status=LOCKED → 401
   - Set `req.user = { id, username, role }`
   - Call `next()`

7. **Create `src/middleware/require-permission.ts`**
   - Export factory: `requirePermission(module: string, action: 'view' | 'create' | 'update' | 'delete')`
   - Returns middleware that:
     - Reads `req.user.role`
     - Queries `prisma.permission.findUnique({ where: { role_module: { role, module } } })`
     - Checks the corresponding `can_view`/`can_create`/`can_update`/`can_delete` field
     - If false → `res.status(403).json({ error: 'Forbidden', module, action })`
     - If true → `next()`

8. **Create `src/routes/auth-routes.ts`**
   - `POST /login`:
     - Body: `{ username: string, password: string }`
     - Find user, compare password, handle LOCKED status
     - Sign JWT, set cookie: `res.cookie('token', jwt, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 })`
     - Load all Permission rows for user.role, format as `{ [module]: { view, create, update, delete } }`
     - Return `{ user: { id, username, role, status }, permissions }`
     - Audit log: login_success or login_fail
   - `POST /logout`:
     - `res.clearCookie('token', { httpOnly: true, sameSite: 'strict', secure: ..., path: '/' })`
     - Return `{ message: 'Logged out' }`
   - `GET /me`:
     - Apply `requireAuth` middleware
     - Load user + permissions
     - Return same shape as login response
   - (No self-service change-password endpoint — password changes are admin-only via `PUT /api/users/:id/reset-password` in Phase 4)

9. **Modify `src/index.ts`**
   - a. Add startup validation: `if (!process.env.JWT_SECRET) { console.error('JWT_SECRET required'); process.exit(1); }`
   - b. `import cookieParser from 'cookie-parser';` → `app.use(cookieParser());` before routes
   - c. Update CORS: `app.use(cors({ origin: process.env.BASE_URL || 'http://localhost:3000', credentials: true }))`
   - d. Import and mount: `app.use('/api/auth', authRoutes);` before other API routes
   - e. Do NOT wire require-auth globally yet — that's Phase 03

10. **Type-check**
    ```bash
    cd backend && pnpm run build
    ```

## Todo List

- [ ] Install jsonwebtoken, cookie-parser, @types
- [ ] Create src/types/express.d.ts (req.user augmentation)
- [ ] Create src/lib/password-utils.ts
- [ ] Create src/lib/jwt-utils.ts
- [ ] Create src/utils/audit-logger.ts
- [ ] Create src/middleware/require-auth.ts
- [ ] Create src/middleware/require-permission.ts
- [ ] Create src/routes/auth-routes.ts (login, logout, me)
- [ ] Modify index.ts: cookie-parser, CORS credentials, JWT_SECRET validation, mount auth routes
- [ ] Type-check passes
- [ ] Manual test: login → cookie set → /me returns user → logout → cookie cleared

## Success Criteria
- `POST /api/auth/login` with valid SAdmin creds returns user+permissions and sets httpOnly cookie
- `POST /api/auth/login` with wrong password returns 401 and logs audit
- `POST /api/auth/login` with LOCKED user returns 401
- `GET /api/auth/me` with valid cookie returns user+permissions
- `GET /api/auth/me` without cookie returns 401
- `POST /api/auth/logout` clears cookie
- `pnpm run build` passes

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| JWT_SECRET leaked in logs | Low | Critical | Never log it; validate presence only |
| cookie-parser import ESM issues | Low | Medium | Verified: cookie-parser has ESM support |
| Token replay after user locked | Medium | Medium | require-auth checks user status on every request (DB hit) |

## Security Considerations
- JWT secret must be strong (32+ chars) — document in deployment guide
- Cookie httpOnly prevents XSS token theft
- SameSite=strict prevents CSRF
- Secure flag in production forces HTTPS
- bcrypt cost 12 = ~250ms per hash — adequate for auth, not a DoS vector at login rate
- LOCKED users rejected at middleware level, not just login
- Audit log captures IP via `req.ip` for forensics

## Next Steps
- Phase 03 wires require-auth globally and adds require-permission to each route file
- Phase 04 builds user/permission CRUD using these middleware

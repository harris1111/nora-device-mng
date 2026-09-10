# System Inspection Redesign & Dedicated Inspection Alert Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the System section's "Kiểm kê" into an unannounced cycle-based "Kiểm định" (Inspection) workflow, and build a dedicated sticky bottom-right popup alert stack that notifies users whenever any system requires inspection without touching the top-left notification bell.

**Architecture:** A new `InspectionAlertProvider` and `InspectionPopupStack` subsystem anchored in `AppLayout` queries systems with `inventory_status = 'needs_inventory'` on cold launch, manages dismissal in `sessionStorage`, and renders stacked interactive cards that navigate to `/systems/:id` on click. In parallel, the System section UI (`InventorySection`, `InventoryHistory`, `device-detail-page`) and backend scheduler are updated to treat system inspection as unannounced (`notify_days_before = 0`) with "Kiểm định" terminology.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4, React Router v6, Axios, Express, Prisma, Node.js.

**Spec:** `docs/superpowers/specs/2026-09-11-system-inspection-and-popup-alerts-design.md`

## Global Constraints

- Systems only (`type === 'system'` / `/systems/*`) switch terminology to "Kiểm định"; regular devices (`type === 'tai_san'`) remain "Kiểm kê".
- Inspection cycle for systems is strictly unannounced: no advance notice (`notify_days_before = 0` / hidden from UI).
- Bottom-right inspection popups must remain sticky until manually dismissed.
- Dismissals are session-scoped (`sessionStorage`), reappearing when the web app is freshly launched in a new tab/browser.
- The existing top-left `NotificationBell` component and regular notifications must remain 100% untouched.

---

### Task 1: Backend Inspection Schedule & Unannounced Cycle Alignment

**Files:**
- Modify: `backend/src/routes/inventory-schedule-routes.ts:22-75`
- Modify: `backend/src/lib/inventory-scheduler.ts:25-50`

**Interfaces:**
- Consumes: Prisma `Device` and `ScheduledInventory` models.
- Produces: System schedules saved with `notifyDaysBefore = 0` when device type is `system`, preventing advance notifications.

- [ ] **Step 1: Update schedule upsert route to enforce `notifyDaysBefore: 0` for systems**

In `backend/src/routes/inventory-schedule-routes.ts`, check the device type during upsert:
```typescript
const device = await prisma.device.findUnique({ where: { id: deviceId }, select: { type: true } });
if (!device) return res.status(404).json({ error: 'Device not found' });

// For systems, inspections are unannounced: force notifyDaysBefore to 0
const effectiveNotifyDays = device.type === 'system' ? 0 : input.notify_days_before ?? 7;
```
Ensure upsert uses `effectiveNotifyDays`.

- [ ] **Step 2: Update inventory scheduler to skip advance notification for systems**

In `backend/src/lib/inventory-scheduler.ts`:
In Section 1 (advance-notice notification loop):
```typescript
if (sched.device.type === 'system') {
  // Systems operate strictly on an unannounced cycle: do not send advance notice
  continue;
}
```
This ensures advance notice only fires for regular `tai_san` devices, while systems transition strictly on/after `nextDueAt <= now` via Section 2 (`inventory_status = 'needs_inventory'`).

- [ ] **Step 3: Verify backend type-check passes**

Run in terminal:
```bash
cd backend && npm run build
```
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/inventory-schedule-routes.ts backend/src/lib/inventory-scheduler.ts
git commit -m "fix(backend): enforce unannounced inspection cycles for systems"
```

---

### Task 2: System Section UI Redesign ("Kiểm định")

**Files:**
- Modify: `frontend/src/components/inventory/inventory-section.tsx`
- Modify: `frontend/src/components/inventory/inventory-history.tsx`
- Modify: `frontend/src/pages/device-detail-page.tsx:399-420`
- Modify: `frontend/src/pages/system-list-page.tsx:30-65`

**Interfaces:**
- Consumes: `InventorySection` props: `deviceId`, `inventoryStatus`, `isSystem`, `onChange`.
- Produces: Dynamic "Kiểm định" headers, badges, and hidden "Báo trước" input for systems.

- [ ] **Step 1: Add `isSystem` support and rename labels in `InventorySection`**

In `frontend/src/components/inventory/inventory-section.tsx`:
Add `isSystem?: boolean` to `Props`.
Update labels:
- Header: `{isSystem ? 'Cài đặt kiểm định' : 'Cài đặt kiểm kê'}`
- Badge:
  ```tsx
  const statusBadge = inventoryStatus === 'needs_inventory' ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
      <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" /> {isSystem ? 'Cần kiểm định' : 'Cần kiểm kê'}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> {isSystem ? 'Đang hoạt động' : 'Đang sử dụng'}
    </span>
  );
  ```
- Subtitle in schedule view:
  ```tsx
  <p className="text-xs font-semibold text-sky-700 uppercase tracking-wide">
    {isSystem ? 'Lịch kiểm định' : 'Lịch kiểm kê'}
  </p>
  ```
  If `isSystem`, display:
  `Chu kỳ: {schedule.interval_days} ngày (không báo trước)` instead of showing `Báo trước: X ngày`.
- In edit form:
  If `isSystem`, completely hide the "Báo trước (ngày)" input block, and force `notify = 0` in `handleSaveSchedule`.

- [ ] **Step 2: Update `InventoryHistory` for system mode**

In `frontend/src/components/inventory/inventory-history.tsx`:
Add `isSystem?: boolean` to `Props`.
Update labels:
- Section title: `{isSystem ? 'Lịch sử kiểm định' : 'Lịch sử kiểm kê'} ({records.length})`
- Add record button: `{isSystem ? 'Ghi nhận kiểm định' : 'Thêm kiểm kê'}`
- Modal title: `{isSystem ? 'Ghi nhận kiểm định hệ thống' : 'Thêm kiểm kê thiết bị'}`

- [ ] **Step 3: Wire `isSystem` in `device-detail-page.tsx` and update filter in `system-list-page.tsx`**

In `frontend/src/pages/device-detail-page.tsx`:
Pass `isSystem={isSystem}` to both `<InventorySection />` and `<InventoryHistory />`.
Update the section header for history from `Lịch sử kiểm kê` to `{isSystem ? 'Lịch sử kiểm định' : 'Lịch sử kiểm kê'}`.

In `frontend/src/pages/system-list-page.tsx`:
Update filter bar option labels if displayed to say "Cần kiểm định" / "Đang hoạt động".

- [ ] **Step 4: Verify frontend type-checking**

Run in terminal:
```bash
cd frontend && npm run lint
```
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/inventory/ frontend/src/pages/device-detail-page.tsx frontend/src/pages/system-list-page.tsx
git commit -m "feat(ui): redesign system inventory section to inspection (kiểm định)"
```

---

### Task 3: Inspection Alert State Management (`InspectionAlertContext`)

**Files:**
- Create: `frontend/src/context/inspection-alert-context.tsx`

**Interfaces:**
- Produces:
  ```typescript
  export interface InspectionAlertContextType {
    alerts: Device[];
    dismissAlert: (id: string) => void;
    dismissAll: () => void;
    refetch: () => Promise<void>;
  }
  ```

- [ ] **Step 1: Create `InspectionAlertContext` with `sessionStorage` persistence**

Create `frontend/src/context/inspection-alert-context.tsx`:
```typescript
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getDevices, type Device } from '../api/device-api';

const STORAGE_KEY = 'dismissed_system_inspections';

interface InspectionAlertContextType {
  alerts: Device[];
  dismissAlert: (id: string) => void;
  dismissAll: () => void;
  refetch: () => Promise<void>;
}

const InspectionAlertContext = createContext<InspectionAlertContextType | null>(null);

function getDismissedIds(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDismissedIds(ids: string[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch { /* ignore storage quotas */ }
}

export function InspectionAlertProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<Device[]>([]);

  const fetchDueSystems = useCallback(async () => {
    try {
      const res = await getDevices({ type: 'system', inventory_status: 'needs_inventory', limit: 50 });
      const dismissed = getDismissedIds();
      const active = (res.items || []).filter(item => !dismissed.includes(item.id));
      setAlerts(active);
    } catch {
      // Fail silently to prevent disrupting the application
    }
  }, []);

  useEffect(() => {
    void fetchDueSystems();
    const handleFocus = () => { void fetchDueSystems(); };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchDueSystems]);

  const dismissAlert = useCallback((id: string) => {
    const dismissed = getDismissedIds();
    if (!dismissed.includes(id)) {
      dismissed.push(id);
      saveDismissedIds(dismissed);
    }
    setAlerts(prev => prev.filter(item => item.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    const dismissed = getDismissedIds();
    alerts.forEach(a => {
      if (!dismissed.includes(a.id)) dismissed.push(a.id);
    });
    saveDismissedIds(dismissed);
    setAlerts([]);
  }, [alerts]);

  return (
    <InspectionAlertContext.Provider value={{ alerts, dismissAlert, dismissAll, refetch: fetchDueSystems }}>
      {children}
    </InspectionAlertContext.Provider>
  );
}

export function useInspectionAlerts(): InspectionAlertContextType {
  const ctx = useContext(InspectionAlertContext);
  if (!ctx) throw new Error('useInspectionAlerts must be used within an InspectionAlertProvider');
  return ctx;
}
```

- [ ] **Step 2: Verify lint passes**

Run: `cd frontend && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/context/inspection-alert-context.tsx
git commit -m "feat(context): add inspection alert context with session storage persistence"
```

---

### Task 4: Bottom-Right Sticky Inspection Alert Popup Components

**Files:**
- Create: `frontend/src/components/inspection/inspection-alert-card.tsx`
- Create: `frontend/src/components/inspection/inspection-popup-stack.tsx`

**Interfaces:**
- Consumes: `useInspectionAlerts()`, `Device`
- Produces: Floating interactive notification cards docked at `fixed bottom-5 right-5 z-50`.

- [ ] **Step 1: Create `InspectionAlertCard`**

Create `frontend/src/components/inspection/inspection-alert-card.tsx`:
```tsx
import { useNavigate } from 'react-router-dom';
import type { Device } from '../../api/device-api';

interface Props {
  system: Device;
  onDismiss: (id: string) => void;
}

export default function InspectionAlertCard({ system, onDismiss }: Props) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/systems/${system.id}`);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss(system.id);
  };

  const locationLabel = [
    system.room?.name,
    system.area?.name,
    system.location?.name,
  ].filter(Boolean).join(' · ');

  return (
    <div
      onClick={handleCardClick}
      className="pointer-events-auto group relative w-full bg-white/95 backdrop-blur-md border-l-4 border-l-amber-500 border border-slate-200/80 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 p-4 cursor-pointer hover:-translate-y-0.5"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            CẦN KIỂM ĐỊNH
          </span>
          {system.storeId && (
            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              {system.storeId}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 -mr-1 -mt-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          title="Đóng thông báo này"
          aria-label="Đóng thông báo"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mt-2">
        <h4 className="text-sm font-bold text-slate-800 group-hover:text-amber-600 transition-colors line-clamp-1">
          {system.name}
        </h4>
        {locationLabel && (
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {locationLabel}
          </p>
        )}
        <p className="text-xs text-amber-600/90 font-medium mt-1 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Đến chu kỳ kiểm định định kỳ
        </p>
      </div>

      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-400 text-[11px]">Bấm để kiểm tra chi tiết</span>
        <span className="font-semibold text-amber-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
          Kiểm tra ngay &rarr;
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `InspectionPopupStack`**

Create `frontend/src/components/inspection/inspection-popup-stack.tsx`:
```tsx
import { useInspectionAlerts } from '../../context/inspection-alert-context';
import InspectionAlertCard from './inspection-alert-card';

const MAX_VISIBLE = 3;

export default function InspectionPopupStack() {
  const { alerts, dismissAlert, dismissAll } = useInspectionAlerts();

  if (!alerts || alerts.length === 0) return null;

  const visibleAlerts = alerts.slice(0, MAX_VISIBLE);
  const remainingCount = alerts.length - MAX_VISIBLE;

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 flex flex-col-reverse gap-2.5 w-[calc(100vw-2rem)] sm:w-96 pointer-events-none max-h-[calc(100vh-5rem)] overflow-y-auto pr-1">
      {/* Action bar if multiple items */}
      {alerts.length >= 2 && (
        <div className="pointer-events-auto flex items-center justify-between bg-slate-900/80 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-lg shadow-md">
          <span>{alerts.length} hệ thống cần kiểm định</span>
          <button
            type="button"
            onClick={dismissAll}
            className="text-amber-300 hover:text-amber-200 font-semibold underline"
          >
            Bỏ qua tất cả
          </button>
        </div>
      )}

      {/* Overflow indicator */}
      {remainingCount > 0 && (
        <div className="pointer-events-auto text-center text-xs font-semibold py-1 px-3 bg-amber-50/90 text-amber-800 border border-amber-200 rounded-lg shadow-sm">
          +{remainingCount} hệ thống khác đang chờ kiểm định
        </div>
      )}

      {/* Stacked cards */}
      {visibleAlerts.map(sys => (
        <InspectionAlertCard
          key={sys.id}
          system={sys}
          onDismiss={dismissAlert}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify lint passes**

Run: `cd frontend && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/inspection/
git commit -m "feat(ui): implement inspection alert card and stacked popup components"
```

---

### Task 5: Integrate Alert Stack into `AppLayout` & Verify Isolation

**Files:**
- Modify: `frontend/src/App.tsx:29-35`
- Modify: `frontend/src/components/layout/app-layout.tsx:1-20,380-396`

**Interfaces:**
- Consumes: `InspectionAlertProvider`, `InspectionPopupStack`
- Produces: Persistent bottom-right alert stack across all authenticated routes.

- [ ] **Step 1: Wrap `AdminLayout` with `InspectionAlertProvider` in `App.tsx`**

In `frontend/src/App.tsx`:
```tsx
import { InspectionAlertProvider } from './context/inspection-alert-context';
import InspectionPopupStack from './components/inspection/inspection-popup-stack';

function AdminLayout() {
  return (
    <InspectionAlertProvider>
      <AppLayout>
        <Outlet />
      </AppLayout>
      <InspectionPopupStack />
    </InspectionAlertProvider>
  );
}
```

- [ ] **Step 2: Verify `NotificationBell` in `app-layout.tsx` is completely untouched**

Inspect `components/layout/app-layout.tsx` lines 22-26:
Ensure `<NotificationBell />` in `ShellActionButtons` is unmodified and undisturbed.

- [ ] **Step 3: Verify build and type-checks pass**

Run:
```bash
cd frontend && npm run lint && npm run build
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/layout/app-layout.tsx
git commit -m "feat(layout): mount inspection alert provider and popup stack into app layout"
```

---

### Task 6: Full Verification & E2E Testing

**Files:**
- Verification only

- [ ] **Step 1: Full backend build verification**

Run:
```bash
cd backend && npm run build
```
Expected: PASS with 0 errors.

- [ ] **Step 2: Full frontend build verification**

Run:
```bash
cd frontend && npm run build
```
Expected: PASS with 0 errors.

- [ ] **Step 3: End-to-End browser walkthrough**

Test all core requirements:
1. Verify bottom-right alert popup appears when a system has `inventory_status = 'needs_inventory'`.
2. Verify clicking card body routes to `/systems/:id`.
3. Verify clicking `(✕)` dismisses card for current session (`sessionStorage`).
4. Verify navigating across `/devices`, `/rooms`, `/locations` does NOT resurrect dismissed cards.
5. Verify opening app in a fresh tab restores sticky alerts.
6. Verify `/systems/:id` displays "Cài đặt kiểm định", "Lịch sử kiểm định", "Cần kiểm định", and no advance notice input.
7. Verify top-left notification bell continues operating unchanged.

- [ ] **Step 4: Git status clean check & completion**

```bash
git status
```
Confirm all changes are tracked and clean.

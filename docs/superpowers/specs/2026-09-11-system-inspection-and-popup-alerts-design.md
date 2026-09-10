# System Inspection Redesign & Dedicated Inspection Alert Popup

## 1. Overview & Context

This design specification details the technical architecture and UI/UX implementation for:
1. Redesigning the "Kiểm kê" (Inventory) section for systems (`type: 'system'`) into **"Kiểm định" (Inspection)** operating strictly on an unannounced cycle basis.
2. Introducing a dedicated, sticky, bottom-right popup alert subsystem that alerts administrators whenever any system requires inspection.
3. Preserving the existing top-left regular notification bell untouched with complete architectural isolation.

---

## 2. Core Requirements

### Requirement 1: Module Redesign (System Section)
- **Terminology**: For systems (`device.type === 'system'` or under `/systems/*`), rename all user-facing instances of "Kiểm kê" to **"Kiểm định" (Inspection)**:
  - Section header: *"Cài đặt kiểm định"*
  - Status badge: *"Cần kiểm định"* (amber/rose) / *"Đang hoạt động"* (emerald)
  - Record history: *"Lịch sử kiểm định"*
  - Action buttons: *"Ghi nhận kiểm định"*, *"Biên bản kiểm định"*
- **Unannounced Cycle Mechanics**:
  - The inspection schedule operates strictly on recurrence cycles (interval days) without prior advance announcements.
  - In the schedule setup form, the *"Báo trước (ngày)"* (`notify_days_before`) input field is hidden for systems and defaulted to `0`.
  - Regular devices (`/devices`, `type === 'tai_san'`) remain completely untouched as *"Kiểm kê"* with their standard advance notification settings.

### Requirement 2: Critical Notification Popup (UI/UX Specifications)
- **Trigger**: Automatically displays when one or more systems have an inspection due (`inventory_status === 'needs_inventory'`).
- **Position**: Anchored at the bottom-right corner (`fixed bottom-5 right-5 z-50`).
- **Persistence**:
  - **Sticky**: Does not auto-hide or expire on a timer; remains visible until manually closed by the user.
  - **Session Scope**: Dismissing a card hides it for the current browsing session (`sessionStorage`), persisting across route navigations within the Single Page Application (SPA).
  - **Fresh Launch Reappearance**: Upon closing the browser/tab and reopening the application (or launching afresh in a new tab), any unresolved inspections reappear immediately.
- **Stacking & Multi-alert Handling**:
  - Displays multiple alerts stacked vertically from the bottom-right upwards.
  - Maximum 3 visible cards stacked simultaneously; if more than 3 systems are due, displays a sticky counter bar (*"+N hệ thống khác đang cần kiểm định"*) and offers a *"Bỏ qua tất cả trong phiên này"* action.
- **Interactions**:
  - **Dismiss (✕) Button**: Located at the top-right of each card. Stops click propagation and dismisses that card for the current session.
  - **Card Body Click**: Clicking anywhere on the card body navigates directly to the system detail page (`/systems/:id`).

### Requirement 3: Scope Limitation
- This popup alert system is strictly dedicated to inspections only.
- The standard notification bell in the top-left corner (`components/notification/notification-bell.tsx`) and its SSE broadcast stream remain completely untouched and unmodified.

---

## 3. Architecture & Data Flow

```
+-------------------------------------------------------------------------+
|                               AppLayout                                 |
|                                                                         |
|  [Top-Left]                                            [Top-Right]      |
|  NotificationBell (Standard Notifications - Untouched)  User Menu       |
|                                                                         |
|  ---------------------------------------------------------------------  |
|  [Main Content / Outlet: /systems, /devices, /rooms, ...]               |
|                                                                         |
|                                                     [Bottom-Right]      |
|                                                     InspectionPopupStack|
|                                                     +-----------------+ |
|                                                     | Inspection Card | |
|                                                     | - System Code   | |
|                                                     | - System Name   | |
|                                                     | - Due Warning   | |
|                                                     | - (X) Dismiss   | |
|                                                     +-----------------+ |
+-------------------------------------------------------------------------+
                                 |
                       Queries on App Launch
                                 v
                 GET /api/devices?type=system&inventory_status=needs_inventory
                                 |
                     Filters dismissed IDs from
                  sessionStorage['dismissed_inspections']
```

### 3.1 State Management (`InspectionAlertContext`)
- **Location**: `frontend/src/context/inspection-alert-context.tsx`
- **State Properties**:
  - `alerts: Device[]`: List of active systems needing inspection.
  - `dismissedIds: string[]`: Array of dismissed system IDs read from and synced with `sessionStorage.getItem('dismissed_system_inspections')`.
  - `dismissAlert(id: string): void`: Appends the ID to `dismissedIds`, writes back to `sessionStorage`, and removes it from `alerts`.
  - `dismissAll(): void`: Dismisses all currently visible and queued alerts for the current session.
  - `refetch(): Promise<void>`: Refetches due systems from `/api/devices?type=system&inventory_status=needs_inventory&limit=50`.
- **Event Listeners**:
  - `window.addEventListener('focus', refetch)`: Automatically syncs alert status when returning to the tab.
  - Invalidation hook: Triggered when an inspection is saved or updated in `device-detail-page.tsx`.

---

## 4. Component Breakdown & Layout

### 4.1 Frontend Components

#### 1. `InspectionAlertProvider` (`frontend/src/context/inspection-alert-context.tsx`)
Provides the alert context and state to `AppLayout`.

#### 2. `InspectionPopupStack` (`frontend/src/components/inspection/inspection-popup-stack.tsx`)
- Container:
  ```html
  <div className="fixed bottom-5 right-5 z-50 flex flex-col-reverse gap-2.5 w-[calc(100vw-2.5rem)] sm:w-96 pointer-events-none max-h-[calc(100vh-6rem)] overflow-y-auto">
  ```
- Renders visible `InspectionAlertCard` elements with slide-in animation.
- If `alerts.length > 3`, displays a compact summary banner with remaining count and a *"Bỏ qua tất cả"* button.

#### 3. `InspectionAlertCard` (`frontend/src/components/inspection/inspection-alert-card.tsx`)
- Props: `system: Device; onDismiss: (id: string) => void;`
- Card layout:
  - Glassmorphic card container with `pointer-events-auto`, amber-500 left accent border, and `hover:shadow-lg` transition.
  - Top row: `[CẦN KIỂM ĐỊNH]` badge in rose/amber + dismiss `(✕)` button with `aria-label="Đóng thông báo"`.
  - Middle: System Name (`font-semibold text-slate-800`), store ID tag, and location/room context.
  - Bottom: Overdue indicator message + `"Kiểm tra ngay →"` call to action.
  - Click handler:
    ```typescript
    const handleClick = () => {
      navigate(`/systems/${system.id}`);
    };
    ```

#### 4. System Section Updates (`frontend/src/components/inventory/inventory-section.tsx`)
- Add an optional prop or detect system type:
  ```typescript
  interface Props {
    deviceId: string;
    inventoryStatus?: 'in_use' | 'needs_inventory';
    isSystem?: boolean;
    onChange?: () => void;
  }
  ```
- If `isSystem === true`:
  - Section title renders: **"Cài đặt kiểm định"**
  - Status badge renders: **"Cần kiểm định"** / **"Đang hoạt động"**
  - In schedule editing mode:
    - Hide the *"Báo trước (ngày)"* input.
    - Submit payload sets `notify_days_before: 0`.

#### 5. History Section Updates (`frontend/src/components/inventory/inventory-history.tsx`)
- If `isSystem === true`:
  - Header: **"Lịch sử kiểm định"**
  - Add button: **"Ghi nhận kiểm định"**

#### 6. System List & Detail Pages (`system-list-page.tsx`, `device-detail-page.tsx`)
- Update labels and filter options from "Kiểm kê" to "Kiểm định".
- Pass `isSystem={true}` to `InventorySection` and `InventoryHistory`.

---

## 5. Backend Logic Alignment

In `backend/src/lib/inventory-scheduler.ts`:
- When scheduling or checking schedules for `device.type === 'system'`:
  - Advance notification is bypassed since `notify_days_before === 0`.
  - When `now >= next_due_at`, `inventory_status` transitions directly to `'needs_inventory'`.
  - No advance warning notification is sent, fulfilling the "unannounced" operational rule.

---

## 6. Error Handling & Edge Cases

1. **Network Disconnection / Backend Error**:
   - `getDevices` call in `InspectionAlertProvider` catches errors silently so page rendering is never blocked.
2. **Rapid Multi-Click on Dismiss / Card**:
   - `e.stopPropagation()` on the dismiss button guarantees navigation is never accidentally triggered when closing a popup.
3. **Screen Clutter / Large Volume of Overdue Systems**:
   - Capped at top 3 cards + overflow summary indicator.
   - User can dismiss all for the session in one click.
4. **Mobile Layouts**:
   - Responsive classes (`w-[calc(100vw-2.5rem)] sm:w-96 bottom-3 right-3 sm:bottom-5 sm:right-5`) ensure clean docking without horizontal scrollbars.

---

## 7. Verification & Testing Plan

### 7.1 Automated Checks
- `tsc --noEmit` on `frontend` and `backend` to ensure zero compilation or type regressions.
- `vite build` on `frontend` to verify successful asset bundling.

### 7.2 Manual Test Scenarios
1. **Cold Launch with Overdue Systems**:
   - Seed/set a system to `inventory_status: 'needs_inventory'`.
   - Open the web app $\rightarrow$ verify the bottom-right popup card appears immediately and stays sticky.
2. **Dismissal & Session Continuity**:
   - Dismiss the card with `(✕)`.
   - Navigate to `/devices`, `/rooms`, `/settings` $\rightarrow$ card remains dismissed.
   - Close browser tab, open new tab to app $\rightarrow$ card reappears.
3. **Card Body Navigation**:
   - Click anywhere on the card $\rightarrow$ routes to `/systems/:id`.
4. **Resolution Auto-Clear**:
   - Complete an inspection on that system $\rightarrow$ verify popup removes itself.
5. **System Section UI**:
   - Verify headers show "Cài đặt kiểm định", "Lịch sử kiểm định", "Cần kiểm định", and "Báo trước" input is absent.
6. **Bell Isolation**:
   - Verify top-left notification bell continues operating as normal without any alterations.

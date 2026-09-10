import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getDevices, type Device } from '../api/device-api';

const STORAGE_KEY = 'dismissed_system_inspections';

export interface InspectionAlertContextType {
  alerts: Device[];
  dismissAlert: (id: string) => void;
  dismissAll: () => void;
  refetch: () => Promise<void>;
}

const InspectionAlertContext = createContext<InspectionAlertContextType | null>(null);

function getDismissedIds(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
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

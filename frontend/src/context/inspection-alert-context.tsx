import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
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
  const location = useLocation();

  const fetchDueSystems = useCallback(async () => {
    try {
      const [byInventory, byStatus] = await Promise.all([
        getDevices({ type: 'system', inventory_status: 'needs_inventory', limit: 50 }).catch(() => ({ items: [] as Device[] })),
        getDevices({ type: 'system', status: 'needs_inventory', limit: 50 }).catch(() => ({ items: [] as Device[] })),
      ]);
      const dismissed = getDismissedIds();
      const uniqueMap = new Map<string, Device>();
      [...(byInventory.items || []), ...(byStatus.items || [])].forEach(item => {
        if (!dismissed.includes(item.id)) {
          uniqueMap.set(item.id, item);
        }
      });
      setAlerts(Array.from(uniqueMap.values()));
    } catch {
      // Fail silently to prevent disrupting the application
    }
  }, []);

  // Fetch on mount and on route changes
  useEffect(() => {
    void fetchDueSystems();
  }, [location.pathname, fetchDueSystems]);

  // Periodic polling (every 30s) and window focus refetch
  useEffect(() => {
    const handleFocus = () => { void fetchDueSystems(); };
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(() => { void fetchDueSystems(); }, 30_000);
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
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

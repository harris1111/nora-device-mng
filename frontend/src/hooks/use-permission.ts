import { useAuth } from '../context/auth-context';

export function useCan(module: string, action: 'view' | 'create' | 'update' | 'delete' | 'export'): boolean {
  const { permissions } = useAuth();
  return permissions[module]?.[action] ?? false;
}

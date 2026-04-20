import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginApi, logoutApi, getMeApi, type AuthUser, type PermissionMap } from '../api/auth-api';

interface AuthContextValue {
  user: AuthUser | null;
  permissions: PermissionMap;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<PermissionMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (window.location.pathname.startsWith('/public/device/')) {
      setIsLoading(false);
      return;
    }

    getMeApi()
      .then(({ user, permissions }) => {
        setUser(user);
        setPermissions(permissions);
      })
      .catch(() => {
        setUser(null);
        setPermissions({});
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { user, permissions } = await loginApi(username, password);
    setUser(user);
    setPermissions(permissions);
  }, []);

  const logout = useCallback(async () => {
    try { await logoutApi(); } catch { /* ignore */ }
    setUser(null);
    setPermissions({});
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ user, permissions, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

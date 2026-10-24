'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import type { AuthUser, AuthContextType, RegisterData } from '@/types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Guarantee identical SSR and client initial state to prevent React error #418
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const pathname = usePathname();
  const lastRefreshTimeRef = useRef<number>(Date.now());
  const isPublicAuthPage = useMemo(
    () => ['/login', '/register', '/forgot-password', '/reset-password'].includes(pathname),
    [pathname]
  );

  const saveUser = useCallback((newUser: AuthUser | null) => {
    setUser(newUser);
    if (typeof window !== 'undefined') {
      try {
        if (newUser) {
          localStorage.setItem('ds_auth_user', JSON.stringify(newUser));
        } else {
          localStorage.removeItem('ds_auth_user');
        }
      } catch {}
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second safety abort

      const res = await fetch('/api/auth/me', {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store',
        },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const freshUser = json.data?.user || null;
        saveUser(freshUser);
        lastRefreshTimeRef.current = Date.now();
      } else if (res.status === 401 || res.status === 403) {
        saveUser(null);
      }
    } catch {
      // Network hiccup or server timeout: preserve active session
    } finally {
      setIsLoading(false);
    }
  }, [saveUser]);

  useEffect(() => {
    // Restore cached session immediately on client mount
    try {
      const cached = localStorage.getItem('ds_auth_user');
      if (cached) {
        setUser(JSON.parse(cached));
        setIsLoading(false);
      }
    } catch {}

    if (isPublicAuthPage) {
      setIsLoading(false);
      return;
    }
    refreshUser();

    // Silently refresh active user session every 1 hour if tab stays open
    const interval = setInterval(() => {
      refreshUser();
    }, 60 * 60 * 1000);

    // Refresh on tab focus if more than 15 minutes have elapsed since last check
    const handleFocus = () => {
      if (Date.now() - lastRefreshTimeRef.current > 15 * 60 * 1000) {
        refreshUser();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isPublicAuthPage, refreshUser]);

  const login = useCallback(
    async (email: string, password: string, portal: 'player' | 'admin' | 'staff' = 'player') => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, portal }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message || 'Login failed');
      }

      saveUser(json.data.user);
      return json.data.user as AuthUser;
    },
    [saveUser]
  );

  const register = useCallback(
    async (data: RegisterData) => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message || 'Registration failed');
      }

      saveUser(json.data.user);
    },
    [saveUser]
  );

  const logout = useCallback(async (reason?: 'MANUAL' | 'SYSTEM_INACTIVE', lastActiveAt?: number) => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || 'MANUAL', lastActiveAt }),
      });
    } catch {}
    saveUser(null);
  }, [saveUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        loading: isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

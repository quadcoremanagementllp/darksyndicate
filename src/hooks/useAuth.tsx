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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const lastRefreshTimeRef = useRef<number>(Date.now());
  const isPublicAuthPage = useMemo(
    () => ['/login', '/register', '/forgot-password', '/reset-password'].includes(pathname),
    [pathname]
  );

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const json = await res.json();
        setUser(json.data.user);
        lastRefreshTimeRef.current = Date.now();
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
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

      setUser(json.data.user);
      return json.data.user as AuthUser;
    },
    []
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

      setUser(json.data.user);
    },
    []
  );

  const logout = useCallback(async (reason?: 'MANUAL' | 'SYSTEM_INACTIVE') => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || 'MANUAL' }),
      });
    } catch {}
    setUser(null);
  }, []);

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

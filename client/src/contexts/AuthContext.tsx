import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authApi } from '../services/api';
import type { User } from '../types';
import { syncDeviceIfGranted, unregisterDeviceOnLogout } from '../services/fcm';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('auth_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(!user);

  // Check session on mount
  useEffect(() => {
    let mounted = true;
    authApi.me()
      .then((res) => {
        if (mounted && res.data.success && res.data.data) {
          const freshUser = res.data.data as User;
          setUser(freshUser);
          localStorage.setItem('auth_user', JSON.stringify(freshUser));
          syncDeviceIfGranted(freshUser.id);
        }
      })
      .catch((err) => {
        if (mounted && err?.response?.status === 401) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          setUser(null);
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await authApi.login(email, password);
    if (res.data.success && res.data.data) {
      const loggedUser = res.data.data as User;
      const token = (res.data as any).token;
      if (token) {
        localStorage.setItem('auth_token', token);
      }
      localStorage.setItem('auth_user', JSON.stringify(loggedUser));
      setUser(loggedUser);
      syncDeviceIfGranted(loggedUser.id).catch(() => {});
      return loggedUser;
    } else {
      throw new Error(res.data.error ?? 'Login failed');
    }
  };

  const logout = async () => {
    try {
      await unregisterDeviceOnLogout();
      await authApi.logout();
    } catch {
      // ignore
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}


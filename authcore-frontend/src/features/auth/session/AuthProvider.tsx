import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { apiClient } from '@/lib/api-client';
import { accessControlService } from '@/services/access-control.service';
import { authService } from '@/services/auth.service';
import type { EffectiveAccess } from '@/types/access-control';
import type {
  LoginCredentials,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
} from '@/types/auth';
import type { User } from '@/types/user';

export interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  effectiveAccess: EffectiveAccess | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  register: (payload: RegisterPayload) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  logoutAll: (keepCurrentSession?: boolean) => Promise<void>;
  refreshSession: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  refreshEffectiveAccess: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Registration doesn't touch the session: no state needed. */
const register = (payload: RegisterPayload): Promise<RegisterResponse> =>
  authService.register(payload);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [effectiveAccess, setEffectiveAccess] = useState<EffectiveAccess | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEffectiveAccess = useCallback(async () => {
    try {
      const access = await accessControlService.getMyAccess();
      setEffectiveAccess(access);
    } catch {
      // Non-fatal if access control endpoint is not enabled or user lacks permissions
      setEffectiveAccess(null);
    }
  }, []);

  const logoutLocally = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setEffectiveAccess(null);
    apiClient.setAccessToken(null);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const data = await authService.refresh();
      setUser(data.user);
      setAccessToken(data.accessToken);
      apiClient.setAccessToken(data.accessToken);
      await fetchEffectiveAccess();
    } catch {
      logoutLocally();
    }
  }, [fetchEffectiveAccess, logoutLocally]);

  useEffect(() => {
    // Configure API client callback for unauthorized state
    apiClient.setOnUnauthorized(logoutLocally);

    // Initial auth hydration on app startup
    const initAuth = async () => {
      try {
        await refreshSession();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [logoutLocally, refreshSession]);

  const login = useCallback(
    async (credentials: LoginCredentials): Promise<LoginResponse> => {
      const data = await authService.login(credentials);
      setUser(data.user);
      setAccessToken(data.accessToken);
      apiClient.setAccessToken(data.accessToken);
      await fetchEffectiveAccess();
      return data;
    },
    [fetchEffectiveAccess],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authService.logout();
    } finally {
      logoutLocally();
    }
  }, [logoutLocally]);

  const logoutAll = useCallback(
    async (keepCurrentSession = false): Promise<void> => {
      try {
        await authService.logoutAll(keepCurrentSession);
      } finally {
        if (!keepCurrentSession) {
          logoutLocally();
        }
      }
    },
    [logoutLocally],
  );

  const updateUser = useCallback((updatedFields: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updatedFields } : null));
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      accessToken,
      effectiveAccess,
      isLoading,
      isAuthenticated: !!user && !!accessToken,
      login,
      register,
      logout,
      logoutAll,
      refreshSession,
      updateUser,
      refreshEffectiveAccess: fetchEffectiveAccess,
    }),
    [
      user,
      accessToken,
      effectiveAccess,
      isLoading,
      login,
      logout,
      logoutAll,
      refreshSession,
      updateUser,
      fetchEffectiveAccess,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

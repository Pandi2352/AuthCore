import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { accessApi } from '@/features/auth/api/access.api';
import { authApi } from '@/features/auth/api/auth.api';
import type { EffectiveAccess } from '@/features/auth/types/access.types';
import type {
  LoginCredentials,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
} from '@/features/auth/types/auth.types';
import type { User } from '@/features/auth/types/user.types';
import { apiClient } from '@/lib/api';

import { AuthContext, type AuthContextType } from './auth-context';

/** Registration doesn't touch the session: no state needed. */
const register = (payload: RegisterPayload): Promise<RegisterResponse> => authApi.register(payload);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [effectiveAccess, setEffectiveAccess] = useState<EffectiveAccess | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEffectiveAccess = useCallback(async () => {
    try {
      const access = await accessApi.getMyAccess();
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
      const data = await authApi.refresh();
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
      const data = await authApi.login(credentials);
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
      await authApi.logout();
    } finally {
      logoutLocally();
    }
  }, [logoutLocally]);

  const logoutAll = useCallback(
    async (keepCurrentSession = false): Promise<void> => {
      try {
        await authApi.logoutAll(keepCurrentSession);
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

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { toast } from '@/components/ui';
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
import { ERROR_CODES } from '@/lib/constants';
import { setFormatDefaults } from '@/lib/format';

import { AuthContext, type AuthContextType } from './auth-context';
import { tokenStore } from './token-store';

/** Registration doesn't touch the session: no state needed. */
const register = (payload: RegisterPayload): Promise<RegisterResponse> => authApi.register(payload);

/** After a 403, reload the user's permissions at most this often (they may have changed). */
const ACCESS_RELOAD_MIN_INTERVAL_MS = 30_000;

/**
 * Session state. Wires the auth layer into the API client (which imports no feature):
 * - auth adapter: the token from tokenStore, refresh via POST /auth/refresh (httpOnly cookie);
 *   the client shares one refresh between concurrent 401s (refresh-token rotation safe)
 * - "unauthorized" event (refresh failed) → signed out locally
 * - "forbidden" event → permissions reloaded (throttled)
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const accessToken = useSyncExternalStore(tokenStore.subscribe, tokenStore.get, tokenStore.get);
  const [effectiveAccess, setEffectiveAccess] = useState<EffectiveAccess | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastAccessReload = useRef(0);

  // Dates / numbers everywhere follow the signed-in user's language and time zone.
  const language = user?.preferences?.language ?? null;
  const timeZone = user?.preferences?.timezone ?? null;
  useEffect(() => {
    setFormatDefaults({ locale: language, timeZone });
  }, [language, timeZone]);

  const fetchEffectiveAccess = useCallback(async () => {
    lastAccessReload.current = Date.now();
    try {
      setEffectiveAccess(await accessApi.getMyAccess());
    } catch {
      // Non-fatal: access control disabled or not allowed — permission checks see "none".
      setEffectiveAccess(null);
    }
  }, []);

  const logoutLocally = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setEffectiveAccess(null);
  }, []);

  // Register the session with the API client.
  useEffect(() => {
    apiClient.setAuthAdapter({
      getAccessToken: tokenStore.get,
      refreshAccessToken: async () => {
        try {
          const data = await authApi.refresh();
          tokenStore.set(data.accessToken);
          setUser(data.user);
          return data.accessToken;
        } catch {
          return null;
        }
      },
    });
    const offUnauthorized = apiClient.on('unauthorized', () => {
      // Only when a signed-in session ended on its own (not on the sign-in pages).
      if (tokenStore.get()) {
        toast.info('Your session has expired. Please sign in again.', { id: 'session-expired' });
      }
      logoutLocally();
    });
    const offForbidden = apiClient.on('forbidden', (error) => {
      if (!tokenStore.get()) return;
      // Password change required (admin-forced or expired): RequireAuth sends the user to Security.
      if (error.code === ERROR_CODES.AUTH_PASSWORD_EXPIRED) {
        setUser((prev) =>
          prev && !prev.mustChangePassword ? { ...prev, mustChangePassword: true } : prev,
        );
        return;
      }
      if (Date.now() - lastAccessReload.current < ACCESS_RELOAD_MIN_INTERVAL_MS) return;
      void fetchEffectiveAccess();
    });
    return () => {
      offUnauthorized();
      offForbidden();
      apiClient.setAuthAdapter(null);
    };
  }, [logoutLocally, fetchEffectiveAccess]);

  /** Restore the session from the refresh cookie (app start, "reload my session"). */
  const refreshSession = useCallback(async () => {
    const token = await apiClient.refreshAccessToken();
    if (token) await fetchEffectiveAccess();
    else logoutLocally();
  }, [fetchEffectiveAccess, logoutLocally]);

  // App start: one refresh (shared with any request that hits 401 meanwhile).
  useEffect(() => {
    let isActive = true;
    const restore = async () => {
      try {
        await refreshSession();
      } finally {
        if (isActive) setIsLoading(false);
      }
    };
    void restore();
    return () => {
      isActive = false;
    };
  }, [refreshSession]);

  const login = useCallback(
    async (credentials: LoginCredentials): Promise<LoginResponse> => {
      const data = await authApi.login(credentials);
      if (data.accessToken) {
        tokenStore.set(data.accessToken);
        setUser(data.user);
        await fetchEffectiveAccess();
      }
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
        if (!keepCurrentSession) logoutLocally();
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

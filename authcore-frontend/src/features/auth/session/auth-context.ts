import { createContext } from 'react';

import type { EffectiveAccess } from '@/features/auth/types/access.types';
import type {
  LoginCredentials,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
} from '@/features/auth/types/auth.types';
import type { User } from '@/features/auth/types/user.types';

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

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

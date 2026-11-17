import type {
  ChangePasswordPayload,
  ChangePasswordResponse,
  ForgotPasswordPayload,
  LoginCredentials,
  LoginResponse,
  PasswordRequirementsResponse,
  RegisterPayload,
  RegisterResponse,
  ResendEmailVerificationPayload,
  ResetPasswordPayload,
  VerifyEmailLinkPayload,
  VerifyEmailOtpPayload,
  VerifyResetTokenPayload,
  VerifyResetTokenResponse,
} from '@/features/auth/types/auth.types';
import type { User } from '@/features/auth/types/user.types';
import { apiClient } from '@/lib/api';

/** Public / session endpoints: no Bearer token and no refresh-on-401 (they are the auth flow). */
const PUBLIC = { auth: false } as const;

/**
 * Auth endpoints. Pure transport: they return data; the session (token, user) is managed by
 * AuthProvider + tokenStore.
 */
export const authApi = {
  login: (payload: LoginCredentials) =>
    apiClient.post<LoginResponse>('/auth/login', payload, PUBLIC),

  register: (payload: RegisterPayload) =>
    apiClient.post<RegisterResponse>('/auth/register', payload, PUBLIC),

  verifyEmailOtp: (payload: VerifyEmailOtpPayload) =>
    apiClient.post<{ user: User }>('/auth/verify-email/otp', payload, PUBLIC),

  verifyEmailLink: (payload: VerifyEmailLinkPayload) =>
    apiClient.post<{ user: User }>('/auth/verify-email/link', payload, PUBLIC),

  resendEmailVerification: (payload: ResendEmailVerificationPayload) =>
    apiClient.post<null>('/auth/verify-email/resend', payload, PUBLIC),

  /** New access token from the httpOnly refresh cookie (origin-checked by the backend). */
  refresh: () => apiClient.post<LoginResponse>('/auth/refresh', undefined, PUBLIC),

  /** Revokes this session (token sent so the backend knows which one; no refresh on 401). */
  logout: () => apiClient.post<null>('/auth/logout'),

  logoutAll: (keepCurrentSession = false) =>
    apiClient.post<{ revokedSessionCount: number; isCurrentSessionKept: boolean }>(
      '/auth/logout-all',
      {
        keepCurrentSession,
      },
    ),

  getMe: () => apiClient.get<User>('/auth/me'),

  forgotPassword: (payload: ForgotPasswordPayload) =>
    apiClient.post<null>('/auth/forgot-password', payload, PUBLIC),

  verifyResetToken: (payload: VerifyResetTokenPayload) =>
    apiClient.post<VerifyResetTokenResponse>('/auth/verify-reset-token', payload, PUBLIC),

  resetPassword: (payload: ResetPasswordPayload) =>
    apiClient.post<null>('/auth/reset-password', payload, PUBLIC),

  changePassword: (payload: ChangePasswordPayload) =>
    apiClient.patch<ChangePasswordResponse>('/auth/change-password', payload),

  getPasswordRequirements: () =>
    apiClient.get<PasswordRequirementsResponse>('/password-policies/requirements', PUBLIC),

  validatePassword: (password: string, email?: string, username?: string) =>
    apiClient.post<{ isValid: boolean; violations: Array<{ rule: string; message: string }> }>(
      '/password-policies/validate',
      { password, email, username },
      PUBLIC,
    ),

  /** Reopen a self-closed account (public flow). */
  requestRecovery: (payload: { email: string }) =>
    apiClient.post<null>('/account/recovery/request', payload, PUBLIC),

  confirmRecovery: (payload: { email: string; code: string }) =>
    apiClient.post<null>('/account/recovery/confirm', payload, PUBLIC),
};

import { apiClient } from '@/lib/api-client';
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
} from '@/types/auth';
import type { User } from '@/types/user';

export const authService = {
  async login(payload: LoginCredentials) {
    const res = await apiClient.post<LoginResponse>('/auth/login', payload);
    if (res.data.accessToken) {
      apiClient.setAccessToken(res.data.accessToken);
    }
    return res.data;
  },

  async register(payload: RegisterPayload) {
    const res = await apiClient.post<RegisterResponse>('/auth/register', payload);
    return res.data;
  },

  async verifyEmailOtp(payload: VerifyEmailOtpPayload) {
    const res = await apiClient.post<{ user: User }>('/auth/verify-email/otp', payload);
    return res.data;
  },

  async verifyEmailLink(payload: VerifyEmailLinkPayload) {
    const res = await apiClient.post<{ user: User }>('/auth/verify-email/link', payload);
    return res.data;
  },

  async resendEmailVerification(payload: ResendEmailVerificationPayload) {
    const res = await apiClient.post<null>('/auth/verify-email/resend', payload);
    return res;
  },

  async refresh() {
    const res = await apiClient.post<LoginResponse>('/auth/refresh');
    if (res.data.accessToken) {
      apiClient.setAccessToken(res.data.accessToken);
    }
    return res.data;
  },

  async logout() {
    try {
      await apiClient.post<null>('/auth/logout');
    } finally {
      apiClient.setAccessToken(null);
    }
  },

  async logoutAll(keepCurrentSession = false) {
    try {
      return await apiClient.post<{ revokedSessionCount: number; isCurrentSessionKept: boolean }>(
        '/auth/logout-all',
        { keepCurrentSession },
      );
    } finally {
      if (!keepCurrentSession) {
        apiClient.setAccessToken(null);
      }
    }
  },

  async getMe() {
    const res = await apiClient.get<User>('/auth/me');
    return res.data;
  },

  async forgotPassword(payload: ForgotPasswordPayload) {
    const res = await apiClient.post<null>('/auth/forgot-password', payload);
    return res;
  },

  async verifyResetToken(payload: VerifyResetTokenPayload) {
    const res = await apiClient.post<VerifyResetTokenResponse>('/auth/verify-reset-token', payload);
    return res.data;
  },

  async resetPassword(payload: ResetPasswordPayload) {
    const res = await apiClient.post<null>('/auth/reset-password', payload);
    return res;
  },

  async changePassword(payload: ChangePasswordPayload) {
    const res = await apiClient.patch<ChangePasswordResponse>('/auth/change-password', payload);
    return res.data;
  },

  async getPasswordRequirements() {
    const res = await apiClient.get<PasswordRequirementsResponse>(
      '/password-policies/requirements',
    );
    return res.data;
  },

  async validatePassword(password: string, email?: string, username?: string) {
    const res = await apiClient.post<{
      isValid: boolean;
      violations: Array<{ rule: string; message: string }>;
    }>('/password-policies/validate', { password, email, username });
    return res.data;
  },
};

import type { User } from './user.types';

export type RegistrationNextStep =
  'VERIFY_EMAIL_OTP' | 'VERIFY_EMAIL_LINK' | 'AWAIT_APPROVAL' | 'LOGIN';

export interface LoginCredentials {
  email?: string;
  username?: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  user: User;
  isNewDevice: boolean;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  passwordExpiresAt: string | null;
  isPasswordChangeRequired: boolean;
  refreshToken?: string;
  refreshTokenExpiresAt?: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  username?: string;
}

export interface RegisterResponse {
  user: User;
  nextStep: RegistrationNextStep;
  isVerificationEmailSent: boolean;
}

export interface VerifyEmailOtpPayload {
  email: string;
  code: string;
}

export interface VerifyEmailLinkPayload {
  token: string;
}

export interface ResendEmailVerificationPayload {
  email: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface VerifyResetTokenPayload {
  email?: string;
  code?: string;
  token?: string;
}

export interface VerifyResetTokenResponse {
  resetToken: string;
  expiresIn: number;
}

export interface ResetPasswordPayload {
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordResponse {
  revokedSessionCount: number;
  isCurrentSessionKept: boolean;
}

export interface PasswordRequirementsResponse {
  requirements: Array<{
    code: string;
    description: string;
    rule: string;
  }>;
  minLength: number;
  maxLength: number;
  requiresUppercase: boolean;
  requiresLowercase: boolean;
  requiresDigit: boolean;
  requiresSpecialChar: boolean;
}

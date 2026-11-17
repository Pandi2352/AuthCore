/**
 * Field rules shared by the auth and account forms — the same limits as the backend DTOs
 * (authcore-backend/src/modules/auth/constants/auth.constants.ts), so users see the problem
 * before the request. The backend stays the authority (its field errors still show).
 */
import { email, maxLength, pattern, required, type Rule } from './rules';

export const LIMITS = {
  emailMax: 254,
  nameMax: 50,
  usernameMin: 3,
  usernameMax: 30,
  passwordMax: 128,
} as const;

/** Letters (any language), marks, spaces, apostrophes, dots and hyphens; starts with a letter. */
export const PERSON_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u;

/** 3–30 characters: lowercase letters, digits, and . _ - inside. */
export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,28})[a-z0-9]$/;

export const emailRules = <V>(requiredMessage = 'Enter your email address'): Rule<V>[] => [
  required(requiredMessage),
  email(),
  maxLength(LIMITS.emailMax),
];

export const personNameRules = <V>(label: string, isRequired: boolean): Rule<V>[] => [
  ...(isRequired ? [required<V>(`Enter your ${label.toLowerCase()}`)] : []),
  maxLength(LIMITS.nameMax),
  pattern(PERSON_NAME_PATTERN, `${label} can only contain letters, spaces, ' . and -`),
];

export const usernameRules = <V>(isRequired = false): Rule<V>[] => [
  ...(isRequired ? [required<V>('Enter a username')] : []),
  pattern(USERNAME_PATTERN, 'Use 3–30 lowercase letters or numbers (. _ - allowed in the middle)'),
];

export const passwordRules = <V>(requiredMessage = 'Enter your password'): Rule<V>[] => [
  required(requiredMessage),
  maxLength(LIMITS.passwordMax),
];

/** Email / SMS codes: digits only. */
export const codeRules = <V>(
  digits: { min: number; max: number } = { min: 6, max: 8 },
): Rule<V>[] => [
  required('Enter the code from the email'),
  pattern(
    new RegExp(`^\\d{${digits.min},${digits.max}}$`),
    digits.min === digits.max
      ? `Enter the ${digits.min}-digit code`
      : `Enter the ${digits.min}–${digits.max} digit code`,
  ),
];

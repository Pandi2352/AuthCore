/**
 * The password rules shown in the strength indicator and checked before submit.
 * The backend's password policy is the authority (an admin may make it stricter); its
 * field errors still appear under the password field.
 */
export interface PasswordCheck {
  /** Full sentence (validation / screen readers). */
  label: string;
  /** Label under the segment (sm and up). */
  word: string;
  /** Compact label for narrow screens. */
  short: string;
  test: (password: string) => boolean;
}

export const PASSWORD_CHECKS: ReadonlyArray<PasswordCheck> = [
  {
    label: 'At least 8 characters',
    word: '8+ chars',
    short: '8+',
    test: (p) => p.length >= 8,
  },
  {
    label: 'One uppercase letter (A-Z)',
    word: 'Upper',
    short: 'A–Z',
    test: (p) => /[A-Z]/.test(p),
  },
  {
    label: 'One lowercase letter (a-z)',
    word: 'Lower',
    short: 'a–z',
    test: (p) => /[a-z]/.test(p),
  },
  { label: 'One number (0-9)', word: 'Number', short: '0–9', test: (p) => /\d/.test(p) },
  {
    label: 'One special symbol (!@#$%^&* etc.)',
    word: 'Symbol',
    short: '!@#',
    test: (p) => /[^A-Za-z0-9]/.test(p),
  },
];

export const meetsPasswordRequirements = (password: string): boolean =>
  PASSWORD_CHECKS.every((check) => check.test(password));

export const PASSWORD_REQUIREMENTS_MESSAGE = 'The password doesn’t meet all the requirements';

export type StrengthLevel = 'empty' | 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';

/** Rules met (0–5) → level; all rules + 12 or more characters = very strong. */
export function passwordStrength(password: string): { met: number; level: StrengthLevel } {
  const met = PASSWORD_CHECKS.filter((check) => check.test(password)).length;
  if (!password) return { met, level: 'empty' };
  if (met === PASSWORD_CHECKS.length) {
    return { met, level: password.length >= 12 ? 'very-strong' : 'strong' };
  }
  if (met >= 4) return { met, level: 'good' };
  if (met === 3) return { met, level: 'fair' };
  return { met, level: 'weak' };
}

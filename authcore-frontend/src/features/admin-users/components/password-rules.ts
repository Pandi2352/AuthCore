import type { PasswordRequirements } from '../types/create-user.types';

export interface PasswordCheckResult {
  label: string;
  isMet: boolean;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const count = (password: string, pattern: RegExp) => (password.match(pattern) ?? []).length;

/**
 * The active policy's rules the browser can check (common / breached / personal-info checks
 * run on the server when the user is created).
 */
export function passwordChecks(
  rules: PasswordRequirements,
  password: string,
): PasswordCheckResult[] {
  const results: PasswordCheckResult[] = [
    {
      label: `${rules.minimumLength}–${rules.maximumLength} characters`,
      isMet: password.length >= rules.minimumLength && password.length <= rules.maximumLength,
    },
  ];
  const need = (n: number, what: string, pattern: RegExp) => {
    if (n > 0)
      results.push({ label: `At least ${plural(n, what)}`, isMet: count(password, pattern) >= n });
  };
  need(rules.minimumUppercaseCount, 'uppercase letter', /\p{Lu}/gu);
  need(rules.minimumLowercaseCount, 'lowercase letter', /\p{Ll}/gu);
  need(rules.minimumDigitCount, 'digit', /\p{N}/gu);
  need(rules.minimumSpecialCharacterCount, 'special character', /[^\p{L}\p{N}\s]/gu);
  if (!rules.allowWhitespace) results.push({ label: 'No spaces', isMet: !/\s/.test(password) });
  if (rules.maximumRepeatedCharacters > 0) {
    results.push({
      label: `No character more than ${rules.maximumRepeatedCharacters} times in a row`,
      isMet: !new RegExp(`(.)\\1{${rules.maximumRepeatedCharacters}}`, 'u').test(password),
    });
  }
  return results;
}

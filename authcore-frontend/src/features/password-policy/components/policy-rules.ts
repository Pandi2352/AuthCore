import { POLICY_LIMITS, type PasswordPolicyRules } from '../types/password-policy.types';

/** Starting point for a new policy (the backend's built-in default). */
export const NEW_POLICY: PasswordPolicyRules = {
  policyName: '',
  characterLength: { minimum: 8, maximum: 64 },
  complexity: {
    minimumDigitCount: 1,
    minimumSpecialCharacterCount: 1,
    requireUpperAndLowerCase: true,
    minimumUppercaseCount: 0,
    minimumLowercaseCount: 0,
  },
  passwordHistory: { preventReuse: true, historyCount: 5 },
  additionalRules: {
    blockCommonPasswords: true,
    blockCompromisedPasswords: false,
    preventPersonalInfoInPassword: true,
    allowWhitespace: false,
    maximumRepeatedCharacters: 0,
    minimumPasswordAgeHours: 0,
  },
  passwordValidity: {
    enabled: false,
    validityDays: 90,
    notificationDaysBeforeExpiry: [14, 7, 3],
    gracePeriodDays: 0,
    forceChangeOnExpiry: true,
  },
};

/** Only the rule fields (drops id, version, dates …) — what PUT / POST expect. */
export function rulesOf(policy: PasswordPolicyRules): PasswordPolicyRules {
  return {
    policyName: policy.policyName,
    characterLength: { ...policy.characterLength },
    complexity: { ...policy.complexity },
    passwordHistory: { ...policy.passwordHistory },
    additionalRules: { ...policy.additionalRules },
    passwordValidity: {
      ...policy.passwordValidity,
      notificationDaysBeforeExpiry: [...policy.passwordValidity.notificationDaysBeforeExpiry],
    },
  };
}

/** requireUpperAndLowerCase means "at least 1"; an explicit count can raise it. */
export const caseCount = (rules: PasswordPolicyRules, which: 'upper' | 'lower'): number =>
  Math.max(
    rules.complexity.requireUpperAndLowerCase ? 1 : 0,
    which === 'upper'
      ? rules.complexity.minimumUppercaseCount
      : rules.complexity.minimumLowercaseCount,
  );

export type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

export interface PolicyStrength {
  /** 0–100. */
  score: number;
  level: StrengthLevel;
  label: string;
  /** What would raise the score most (at most three). */
  tips: string[];
}

/**
 * How strong the passwords this policy allows are (0–100). Length weighs most (NIST: long
 * passwords beat complexity), then blocked common / breached passwords, then character mix.
 */
export function policyStrength(rules: PasswordPolicyRules): PolicyStrength {
  const { characterLength: length, complexity, passwordHistory: history } = rules;
  const extra = rules.additionalRules;
  const tips: Array<{ gain: number; text: string }> = [];
  let score = 0;

  // Length: 8 → 5 pts, 16+ → 40 pts.
  const lengthPoints = 5 + (Math.min(Math.max(length.minimum - 8, 0), 8) / 8) * 35;
  score += lengthPoints;
  if (length.minimum < 12) tips.push({ gain: 15, text: 'Require at least 12 characters' });

  // Character mix: up to 25.
  const mix =
    (complexity.minimumDigitCount > 0 ? 6 : 0) +
    (complexity.minimumSpecialCharacterCount > 0 ? 7 : 0) +
    (caseCount(rules, 'upper') > 0 ? 5 : 0) +
    (caseCount(rules, 'lower') > 0 ? 4 : 0);
  score += mix + (mix === 22 ? 3 : 0);
  if (complexity.minimumSpecialCharacterCount === 0)
    tips.push({ gain: 7, text: 'Require a special character' });
  if (complexity.minimumDigitCount === 0) tips.push({ gain: 6, text: 'Require a digit' });
  if (!complexity.requireUpperAndLowerCase && caseCount(rules, 'upper') === 0)
    tips.push({ gain: 9, text: 'Require upper and lower case letters' });

  // Known-bad passwords: up to 20.
  if (extra.blockCommonPasswords) score += 10;
  else tips.push({ gain: 10, text: 'Block common passwords' });
  if (extra.blockCompromisedPasswords) score += 10;
  else tips.push({ gain: 10, text: 'Block passwords found in data breaches' });

  // Personal info, repeats, reuse: up to 15.
  if (extra.preventPersonalInfoInPassword) score += 4;
  else tips.push({ gain: 4, text: 'Reject passwords containing the user’s name or email' });
  if (extra.maximumRepeatedCharacters > 0) score += 3;
  if (history.preventReuse) score += 4 + (Math.min(history.historyCount, 10) / 10) * 4;
  else tips.push({ gain: 6, text: 'Prevent reusing previous passwords' });

  const finalScore = Math.round(Math.min(score, 100));
  const level: StrengthLevel =
    finalScore >= 80 ? 'strong' : finalScore >= 60 ? 'good' : finalScore >= 40 ? 'fair' : 'weak';
  const label = { weak: 'Weak', fair: 'Fair', good: 'Good', strong: 'Strong' }[level];
  return {
    score: finalScore,
    level,
    label,
    tips: tips
      .toSorted((a, b) => b.gain - a.gain)
      .slice(0, 3)
      .map((t) => t.text),
  };
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Short chips for cards ("8–64 chars", "1 digit" …). */
export function ruleChips(rules: PasswordPolicyRules): string[] {
  const chips = [`${rules.characterLength.minimum}–${rules.characterLength.maximum} chars`];
  const upper = caseCount(rules, 'upper');
  const lower = caseCount(rules, 'lower');
  if (upper > 0 || lower > 0)
    chips.push(upper === lower ? 'A–Z + a–z' : `${upper} A–Z · ${lower} a–z`);
  if (rules.complexity.minimumDigitCount > 0)
    chips.push(plural(rules.complexity.minimumDigitCount, 'digit'));
  if (rules.complexity.minimumSpecialCharacterCount > 0)
    chips.push(plural(rules.complexity.minimumSpecialCharacterCount, 'symbol'));
  if (rules.passwordHistory.preventReuse)
    chips.push(`No reuse of last ${rules.passwordHistory.historyCount + 1}`);
  if (rules.additionalRules.blockCompromisedPasswords) chips.push('Breach check');
  if (rules.passwordValidity.enabled)
    chips.push(`Expires in ${rules.passwordValidity.validityDays} d`);
  return chips;
}

/** The full rule list in plain sentences (summary card). */
export function ruleSentences(rules: PasswordPolicyRules): string[] {
  const out = [
    `Between ${rules.characterLength.minimum} and ${rules.characterLength.maximum} characters`,
  ];
  const atLeast = (count: number, what: string) => {
    if (count > 0) out.push(`At least ${plural(count, what)}`);
  };
  atLeast(caseCount(rules, 'upper'), 'uppercase letter');
  atLeast(caseCount(rules, 'lower'), 'lowercase letter');
  atLeast(rules.complexity.minimumDigitCount, 'digit');
  atLeast(rules.complexity.minimumSpecialCharacterCount, 'special character');
  const extra = rules.additionalRules;
  if (!extra.allowWhitespace) out.push('No spaces');
  if (extra.maximumRepeatedCharacters > 0)
    out.push(`No character more than ${extra.maximumRepeatedCharacters} times in a row`);
  if (extra.preventPersonalInfoInPassword) out.push('Must not contain the user’s email or name');
  if (extra.blockCommonPasswords) out.push('Common passwords are rejected');
  if (extra.blockCompromisedPasswords) out.push('Passwords from data breaches are rejected');
  if (rules.passwordHistory.preventReuse)
    out.push(`Can’t reuse the last ${plural(rules.passwordHistory.historyCount + 1, 'password')}`);
  if (extra.minimumPasswordAgeHours > 0)
    out.push(`Can change it again after ${plural(extra.minimumPasswordAgeHours, 'hour')}`);
  const validity = rules.passwordValidity;
  if (validity.enabled) {
    out.push(
      `Expires after ${plural(validity.validityDays, 'day')}` +
        (validity.gracePeriodDays > 0
          ? ` (+${plural(validity.gracePeriodDays, 'day')} grace)`
          : ''),
    );
  } else {
    out.push('Never expires');
  }
  return out;
}

/** Checks the backend would also run, applied to the form's rules (field path → message). */
export function validateRules(rules: PasswordPolicyRules): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = rules.policyName.trim();
  if (!name) errors.policyName = 'Enter a name for the policy';
  else if (name.length > POLICY_LIMITS.maxNameLength)
    errors.policyName = `Use at most ${POLICY_LIMITS.maxNameLength} characters`;
  const { minimum, maximum } = rules.characterLength;
  if (minimum > maximum)
    errors['characterLength.minimum'] = 'The minimum can’t be longer than the maximum';
  const required =
    rules.complexity.minimumDigitCount +
    rules.complexity.minimumSpecialCharacterCount +
    caseCount(rules, 'upper') +
    caseCount(rules, 'lower');
  if (required > maximum)
    errors.complexity = `The required characters (${required}) don’t fit in the maximum length (${maximum})`;
  if (rules.additionalRules.maximumRepeatedCharacters === 1)
    errors['additionalRules.maximumRepeatedCharacters'] = 'Use 0 (no limit) or at least 2';
  const validity = rules.passwordValidity;
  if (validity.notificationDaysBeforeExpiry.some((d) => d >= validity.validityDays))
    errors['passwordValidity.notificationDaysBeforeExpiry'] =
      `Reminders must come before the password expires (less than ${validity.validityDays} days)`;
  if (
    validity.enabled &&
    rules.additionalRules.minimumPasswordAgeHours >= validity.validityDays * 24
  )
    errors['additionalRules.minimumPasswordAgeHours'] =
      'The minimum age must be shorter than the validity period';
  return errors;
}

/** Uniform random integer in [0, max). */
function randomInt(max: number): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return (values[0] ?? 0) % max;
}

const pickFrom = (set: string): string => set.charAt(randomInt(set.length));

/** A random password that follows the rules (for the "example" in the editor). */
export function examplePassword(rules: PasswordPolicyRules): string {
  const sets = {
    upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
    lower: 'abcdefghijkmnopqrstuvwxyz',
    digit: '23456789',
    special: '!@#$%&*?-+=',
  };
  const chars: string[] = [];
  const add = (count: number, set: string) => {
    for (let i = 0; i < count; i += 1) chars.push(pickFrom(set));
  };
  add(caseCount(rules, 'upper'), sets.upper);
  add(caseCount(rules, 'lower'), sets.lower);
  add(rules.complexity.minimumDigitCount, sets.digit);
  add(rules.complexity.minimumSpecialCharacterCount, sets.special);
  const target = Math.min(
    Math.max(rules.characterLength.minimum, 14),
    rules.characterLength.maximum,
  );
  const all = sets.upper + sets.lower + sets.digit;
  while (chars.length < target) chars.push(pickFrom(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j] ?? '', chars[i] ?? ''];
  }
  return chars.join('');
}

export interface PasswordTestResult {
  label: string;
  isMet: boolean;
}

/** The form's rules applied to a sample password (the checks the browser can run). */
export function testPassword(rules: PasswordPolicyRules, password: string): PasswordTestResult[] {
  const count = (re: RegExp) => (password.match(re) ?? []).length;
  const results: PasswordTestResult[] = [
    {
      label: `${rules.characterLength.minimum}–${rules.characterLength.maximum} characters`,
      isMet:
        password.length >= rules.characterLength.minimum &&
        password.length <= rules.characterLength.maximum,
    },
  ];
  const need = (n: number, what: string, re: RegExp) => {
    if (n > 0) results.push({ label: `${plural(n, what)}`, isMet: count(re) >= n });
  };
  need(caseCount(rules, 'upper'), 'uppercase letter', /\p{Lu}/gu);
  need(caseCount(rules, 'lower'), 'lowercase letter', /\p{Ll}/gu);
  need(rules.complexity.minimumDigitCount, 'digit', /\p{N}/gu);
  need(rules.complexity.minimumSpecialCharacterCount, 'special character', /[^\p{L}\p{N}\s]/gu);
  if (!rules.additionalRules.allowWhitespace)
    results.push({ label: 'No spaces', isMet: !/\s/.test(password) });
  const maxRun = rules.additionalRules.maximumRepeatedCharacters;
  if (maxRun > 0) {
    results.push({
      label: `No character more than ${maxRun} times in a row`,
      isMet: !new RegExp(`(.)\\1{${maxRun}}`, 'u').test(password),
    });
  }
  return results;
}

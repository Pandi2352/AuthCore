import type { UserProfileDetails } from '@/features/auth';

import type { ProfileFormAttribute } from '../types/account.types';

export interface CompletionStep {
  id: string;
  label: string;
  isDone: boolean;
}

const isFilled = (value: unknown): boolean => {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.values(value).some(isFilled);
  return true;
};

/** Profile fields edited in the "Personal details" form (built-ins have their own editors). */
export const editableAttributes = (form: ProfileFormAttribute[]): ProfileFormAttribute[] =>
  form.filter(
    (a) =>
      a.coreField === null &&
      !a.isPassword &&
      a.mutability !== 'READ_ONLY' &&
      (a.kind === 'FIELD' || (a.children?.length ?? 0) > 0),
  );

/**
 * What makes a profile complete: name, username, photo, verified email, and every profile
 * field (each field / group counts once). Required fields the server reports missing are
 * never counted as done.
 */
export function completionSteps(
  profile: UserProfileDetails,
  form: ProfileFormAttribute[],
  hasPhoto: boolean,
): CompletionStep[] {
  const missing = new Set(profile.missingRequired ?? []);
  const values = profile.attributes ?? {};
  return [
    { id: 'name', label: 'Add your last name', isDone: Boolean(profile.lastName) },
    { id: 'username', label: 'Choose a username', isDone: Boolean(profile.username) },
    { id: 'photo', label: 'Upload a profile photo', isDone: hasPhoto },
    { id: 'email', label: 'Verify your email address', isDone: profile.isEmailVerified },
    ...editableAttributes(form).map((a) => ({
      id: `attr:${a.name}`,
      label: `Add your ${a.label.charAt(0).toLowerCase()}${a.label.slice(1)}`,
      isDone: !missing.has(a.name) && isFilled(values[a.name]),
    })),
  ];
}

export const completionPercent = (steps: CompletionStep[]): number =>
  steps.length === 0
    ? 100
    : Math.round((steps.filter((s) => s.isDone).length / steps.length) * 100);

import { apiClient } from '@/lib/api';

import type { PasswordPolicy, PasswordPolicyRules } from '../types/password-policy.types';

const BASE = '/password-policies';
const byId = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

/** Password policies (PASSWORD_POLICY_READ / PASSWORD_POLICY_MANAGE). Exactly one is active. */
export const passwordPolicyApi = {
  /** The policy in force (the built-in default while none is saved). */
  active: (signal?: AbortSignal) => apiClient.get<PasswordPolicy>(BASE, { signal }),

  /** Every saved policy, the active one first. */
  list: (signal?: AbortSignal) => apiClient.get<PasswordPolicy[]>(`${BASE}/all`, { signal }),

  get: (id: string, signal?: AbortSignal) => apiClient.get<PasswordPolicy>(byId(id), { signal }),

  /** Saved inactive. */
  create: (rules: PasswordPolicyRules) => apiClient.post<PasswordPolicy>(BASE, rules),

  update: (id: string, rules: PasswordPolicyRules) =>
    apiClient.put<PasswordPolicy>(byId(id), rules),

  activate: (id: string) => apiClient.post<PasswordPolicy>(`${byId(id)}/activate`),

  duplicate: (id: string) => apiClient.post<PasswordPolicy>(`${byId(id)}/duplicate`),

  /** Not the active one (409). */
  remove: (id: string) => apiClient.delete<{ id: string }>(byId(id)),
};

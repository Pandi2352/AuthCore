import { apiClient } from '@/lib/api';

import type {
  Availability,
  CreatedUser,
  CreateUserConfig,
  CreateUserRequest,
  GroupOption,
} from '../types/create-user.types';

/** Create user (USER_CREATE). */
export const createUserApi = {
  /** Fields from the user schema, password rules, defaults (one call for the whole form). */
  config: (signal?: AbortSignal) =>
    apiClient.get<CreateUserConfig>('/admin/users/create-config', { signal }),

  /** Live "already taken" check; POST still decides (409). */
  availability: (query: { email?: string; username?: string }, signal?: AbortSignal) =>
    apiClient.get<Availability>('/admin/users/availability', { signal, query }),

  create: (body: CreateUserRequest) => apiClient.post<CreatedUser>('/admin/users', body),

  /** A random password that meets the active policy. */
  generatePassword: (length = 16) =>
    apiClient.post<{ password: string }>('/password-policies/generate-password', { length }),

  /** Groups to add the user to (needs GROUP_READ). */
  groups: (signal?: AbortSignal) => apiClient.get<GroupOption[]>('/groups/dropdown', { signal }),
};

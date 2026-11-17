import type { EffectiveAccess } from '@/features/auth/types/access.types';
import { apiClient } from '@/lib/api';

export const accessApi = {
  /** The signed-in user's roles, groups and permission keys. */
  getMyAccess: (signal?: AbortSignal) =>
    apiClient.get<EffectiveAccess>('/access-control/me', { signal }),
};

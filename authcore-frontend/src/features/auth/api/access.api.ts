import type { EffectiveAccess } from '@/features/auth/types/access.types';
import { apiClient } from '@/lib/api';

export const accessApi = {
  async getMyAccess() {
    const res = await apiClient.get<EffectiveAccess>('/access-control/me');
    return res.data;
  },
};

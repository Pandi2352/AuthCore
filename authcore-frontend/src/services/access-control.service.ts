import { apiClient } from '@/lib/api-client';
import type { EffectiveAccess } from '@/types/access-control';

export const accessControlService = {
  async getMyAccess() {
    const res = await apiClient.get<EffectiveAccess>('/access-control/me');
    return res.data;
  },
};

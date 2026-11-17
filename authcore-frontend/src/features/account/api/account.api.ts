import type {
  KnownDevice,
  Session,
  UserActivityEntry,
} from '@/features/account/types/account.types';
import type { User, UserPreferences, UserProfileDetails } from '@/features/auth';
import { apiClient } from '@/lib/api';

export const accountApi = {
  async getProfile() {
    const res = await apiClient.get<UserProfileDetails>('/users/me');
    return res.data;
  },

  async updateProfile(data: {
    firstName?: string;
    lastName?: string | null;
    username?: string | null;
  }) {
    const res = await apiClient.patch<User>('/users/me', data);
    return res.data;
  },

  async updateAttributes(attributes: Record<string, unknown>) {
    const res = await apiClient.patch<UserProfileDetails>('/users/me/attributes', {
      attributes,
    });
    return res.data;
  },

  async uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<{ picture: string }>('/users/me/avatar', formData);
    return res.data;
  },

  async deleteAvatar() {
    const res = await apiClient.delete<null>('/users/me/avatar');
    return res;
  },

  async getSessions() {
    const res = await apiClient.get<Session[]>('/auth/sessions');
    return res.data;
  },

  async revokeSession(sessionId: string) {
    const res = await apiClient.delete<{
      revokedSessionId: string;
      isCurrentSession: boolean;
    }>(`/auth/sessions/${sessionId}`);
    return res.data;
  },

  async getDevices() {
    const res = await apiClient.get<KnownDevice[]>('/users/me/devices');
    return res.data;
  },

  async revokeDevice(deviceId: string) {
    const res = await apiClient.delete<null>(`/users/me/devices/${deviceId}`);
    return res;
  },

  async getActivity(event?: string) {
    const query = event ? `?event=${encodeURIComponent(event)}` : '';
    const res = await apiClient.get<UserActivityEntry[]>(`/users/me/activity${query}`);
    return res.data;
  },

  async updatePreferences(preferences: Partial<UserPreferences>) {
    const res = await apiClient.patch<UserPreferences>('/users/me/preferences', preferences);
    return res.data;
  },

  async requestEmailChange(payload: { newEmail: string; currentPassword: string }) {
    const res = await apiClient.post<null>('/users/me/email/change', payload);
    return res;
  },

  async confirmEmailChange(payload: { code: string }) {
    const res = await apiClient.post<User>('/users/me/email/confirm', payload);
    return res.data;
  },

  async deactivateAccount(payload: { currentPassword: string; reason?: string }) {
    const res = await apiClient.post<null>('/users/me/deactivate', payload);
    return res;
  },

  async deleteAccount(payload: { currentPassword: string; reason?: string }) {
    const res = await apiClient.delete<null>('/users/me', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res;
  },

  async exportData(currentPassword: string) {
    const res = await apiClient.post<Record<string, unknown>>('/users/me/export', {
      currentPassword,
    });
    return res.data;
  },
};

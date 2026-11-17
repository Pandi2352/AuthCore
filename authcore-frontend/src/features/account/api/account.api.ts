import type {
  KnownDevice,
  Session,
  UserActivityEntry,
} from '@/features/account/types/account.types';
import type { User, UserPreferences, UserProfileDetails } from '@/features/auth';
import { apiClient, downloadFile, uploadFile, type UploadProgress } from '@/lib/api';

/** The signed-in user's own account ("me" endpoints). Every call accepts an AbortSignal where it reads. */
export const accountApi = {
  getProfile: (signal?: AbortSignal) => apiClient.get<UserProfileDetails>('/users/me', { signal }),

  updateProfile: (data: {
    firstName?: string;
    lastName?: string | null;
    username?: string | null;
  }) => apiClient.patch<User>('/users/me', data),

  updateAttributes: (attributes: Record<string, unknown>) =>
    apiClient.patch<UserProfileDetails>('/users/me/attributes', { attributes }),

  /** Multipart upload with progress (resized and virus-scanned by the backend). */
  uploadAvatar: (
    file: File,
    options: { onProgress?: (p: UploadProgress) => void; signal?: AbortSignal } = {},
  ) => uploadFile<{ picture: string }>('/users/me/avatar', file, options),

  deleteAvatar: () => apiClient.delete<null>('/users/me/avatar'),

  getSessions: (signal?: AbortSignal) => apiClient.get<Session[]>('/auth/sessions', { signal }),

  revokeSession: (sessionId: string) =>
    apiClient.delete<{ revokedSessionId: string; isCurrentSession: boolean }>(
      `/auth/sessions/${encodeURIComponent(sessionId)}`,
    ),

  getDevices: (signal?: AbortSignal) =>
    apiClient.get<KnownDevice[]>('/users/me/devices', { signal }),

  revokeDevice: (deviceId: string) =>
    apiClient.delete<null>(`/users/me/devices/${encodeURIComponent(deviceId)}`),

  getActivity: (event?: string, signal?: AbortSignal) =>
    apiClient.get<UserActivityEntry[]>('/users/me/activity', { query: { event }, signal }),

  updatePreferences: (preferences: Partial<UserPreferences>) =>
    apiClient.patch<UserPreferences>('/users/me/preferences', preferences),

  requestEmailChange: (payload: { newEmail: string; currentPassword: string }) =>
    apiClient.post<null>('/users/me/email/change', payload),

  confirmEmailChange: (payload: { code: string }) =>
    apiClient.post<User>('/users/me/email/confirm', payload),

  deactivateAccount: (payload: { currentPassword: string; reason?: string }) =>
    apiClient.post<null>('/users/me/deactivate', payload),

  deleteAccount: (payload: { currentPassword: string; reason?: string }) =>
    apiClient.delete<null>('/users/me', { body: payload }),

  /** "Download my data": the backend returns a JSON file attachment (not the envelope). */
  exportData: (currentPassword: string) =>
    downloadFile('/users/me/export', {
      method: 'POST',
      body: { currentPassword },
      fallbackFilename: 'my-data.json',
    }),
};

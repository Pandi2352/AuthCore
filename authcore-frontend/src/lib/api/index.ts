/**
 * API layer: the only network code in the app (architecture rule). Features call these from
 * their `api/` files; components never fetch directly.
 */
export { ApiError, isAbortError, isApiError, type ApiErrorInit } from './api-error';
export {
  apiClient,
  ApiClient,
  type ApiEvents,
  type AuthAdapter,
  type HttpMethod,
  type RequestOptions,
} from './client';
export { downloadFile, saveBlob, type DownloadOptions } from './download';
export { getErrorMessage, getFieldErrors, getRequestId } from './get-error-message';
export { uploadFile, type UploadOptions, type UploadProgress } from './upload';
export { UPLOAD_ACCEPT, uploadToStorage, type UploadedFile } from './storage-upload';
export type * from './types';

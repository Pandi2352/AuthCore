import { uploadFile, type UploadProgress } from './upload';

/** POST /uploads response data. */
export interface UploadedFile {
  /** File record id (DELETE /files/:id removes it). */
  id: string;
  /** Original file name. */
  name: string;
  /** Object key on the storage. */
  key: string;
  /** Public URL (bucket / CDN, or the API's /files/public/:id). */
  url: string;
  /** Detected from the content, e.g. "image/png". */
  fileType: string;
  /** Bytes as stored. */
  fileSize: number;
  /** PDF page count; 0 for other types. */
  filePages: number;
}

/** Types POST /uploads accepts (checked again on the server, from the content). */
export const UPLOAD_ACCEPT = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/plain',
  '.csv',
  '.txt',
] as const;

/**
 * Upload a file to the active storage (Settings → File storage) and get its URL. The one
 * upload call for every feature (attachments, images, imports …).
 *
 *   const { url, name } = await uploadToStorage(file, { onProgress: (p) => setPercent(p.percent) });
 */
export function uploadToStorage(
  file: File,
  options: { onProgress?: (progress: UploadProgress) => void; signal?: AbortSignal } = {},
): Promise<UploadedFile> {
  return uploadFile<UploadedFile>('/uploads', file, options);
}

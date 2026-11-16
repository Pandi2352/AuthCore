import { FilePurpose, FileVisibility } from '../enums/file.enum';

/** Content types the API can recognise from the file's bytes, and their extension. */
export const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
} as const;

export type DetectedMimeType = keyof typeof MIME_EXTENSIONS;

export interface FilePurposeRule {
  /** Allowed types, checked against the file's content (not its name or header). */
  mimeTypes: readonly DetectedMimeType[];
  visibility: FileVisibility;
  /** 'avatar' = UPLOAD_AVATAR_MAX_SIZE_MB; 'default' = UPLOAD_MAX_FILE_SIZE_MB. */
  sizeLimit: 'avatar' | 'default';
  /** Only one file of this purpose per owner: uploading replaces the previous one. */
  isSingle: boolean;
}

const IMAGES: readonly DetectedMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const FILE_PURPOSES: Record<FilePurpose, FilePurposeRule> = {
  [FilePurpose.Avatar]: {
    mimeTypes: IMAGES,
    visibility: FileVisibility.Public,
    sizeLimit: 'avatar',
    isSingle: true,
  },
  [FilePurpose.Document]: {
    mimeTypes: [...IMAGES, 'image/gif', 'application/pdf'],
    visibility: FileVisibility.Private,
    sizeLimit: 'default',
    isSingle: false,
  },
};

/** Multipart field that carries the file. */
export const UPLOAD_FIELD_NAME = 'file';
export const MAX_ORIGINAL_NAME_LENGTH = 200;
/** Public files never change (new upload = new id), so they can be cached long. */
export const PUBLIC_CACHE_SECONDS = 86_400;

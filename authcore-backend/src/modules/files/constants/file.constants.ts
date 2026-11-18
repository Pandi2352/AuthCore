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
  /** How images are re-encoded (image-processing.service.ts). */
  imageMode: ImageMode;
  /**
   * false = only through its own endpoint (e.g. business settings), never the generic
   * POST /files upload.
   */
  isDirectUpload: boolean;
}

/** avatar: square crop · document: shrink to fit · logo: shrink to fit 1024 × 512 · icon: square canvas, transparent padding. */
export type ImageMode = 'avatar' | 'document' | 'logo' | 'icon';

const IMAGES: readonly DetectedMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

function brandRule(imageMode: ImageMode): FilePurposeRule {
  return {
    mimeTypes: IMAGES,
    visibility: FileVisibility.Public,
    sizeLimit: 'avatar',
    isSingle: true,
    imageMode,
    isDirectUpload: false,
  };
}

export const FILE_PURPOSES: Record<FilePurpose, FilePurposeRule> = {
  [FilePurpose.Avatar]: {
    mimeTypes: IMAGES,
    visibility: FileVisibility.Public,
    sizeLimit: 'avatar',
    isSingle: true,
    imageMode: 'avatar',
    isDirectUpload: true,
  },
  [FilePurpose.Document]: {
    mimeTypes: [...IMAGES, 'image/gif', 'application/pdf'],
    visibility: FileVisibility.Private,
    sizeLimit: 'default',
    isSingle: false,
    imageMode: 'document',
    isDirectUpload: true,
  },
  // Branding: public (shown before sign-in), one per slot. PNG / WebP keep transparency.
  // SVG is not accepted: it can carry scripts.
  [FilePurpose.BrandLogo]: brandRule('logo'),
  [FilePurpose.BrandLogoMark]: brandRule('icon'),
  [FilePurpose.BrandAuthLogo]: brandRule('logo'),
  [FilePurpose.BrandFavicon]: brandRule('icon'),
};

/** Purposes the generic POST /files endpoint accepts. */
export const DIRECT_UPLOAD_PURPOSES: FilePurpose[] = Object.values(
  FilePurpose,
).filter((purpose) => FILE_PURPOSES[purpose].isDirectUpload);

/** Multipart field that carries the file. */
export const UPLOAD_FIELD_NAME = 'file';
export const MAX_ORIGINAL_NAME_LENGTH = 200;
/** Public files never change (new upload = new id), so they can be cached long. */
export const PUBLIC_CACHE_SECONDS = 86_400;

/**
 * What an upload is for. Each purpose has its own rules (types, size,
 * visibility) in FILE_PURPOSES; add a purpose there to support a new kind of upload.
 */
export enum FilePurpose {
  /** Profile picture: public URL, one per user (a new one replaces the old one). */
  Avatar = 'AVATAR',
  /** Private document (ID proof, certificate …): owner and FILE_READ only. */
  Document = 'DOCUMENT',
  /** Business settings → full logo (expanded sidebar, emails). Internal: set via /settings/business. */
  BrandLogo = 'BRAND_LOGO',
  /** Business settings → square mark (collapsed sidebar). Internal. */
  BrandLogoMark = 'BRAND_LOGO_MARK',
  /** Business settings → logo on sign-in / sign-up pages. Internal. */
  BrandAuthLogo = 'BRAND_AUTH_LOGO',
  /** Business settings → browser tab icon. Internal. */
  BrandFavicon = 'BRAND_FAVICON',
  /** POST /uploads: general uploads with a public URL (active storage). Internal. */
  Upload = 'UPLOAD',
}

/** Virus-scan outcome stored with each file. */
export enum ScanStatus {
  /** Scanned by the engine, nothing found. */
  Clean = 'CLEAN',
  /** Scanning is disabled (VIRUS_SCAN_ENABLED=false). */
  NotScanned = 'NOT_SCANNED',
  /** Scanner unreachable and VIRUS_SCAN_FAIL_CLOSED=false: accepted unscanned. */
  ScanFailed = 'SCAN_FAILED',
}

export enum FileVisibility {
  /** Anyone with the link (GET /files/public/:id), e.g. avatars in <img>. */
  Public = 'PUBLIC',
  /** Signed-in owner, or FILE_READ (GET /files/:id/content). */
  Private = 'PRIVATE',
}

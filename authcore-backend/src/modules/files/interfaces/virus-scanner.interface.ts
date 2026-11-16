export interface ScanResult {
  isInfected: boolean;
  /** Malware name reported by the engine (only when infected). */
  signature: string | null;
}

/**
 * Malware scanning of uploads. The API talks to this interface only, so
 * ClamAV can be replaced by another engine (or a cloud scanning API).
 */
export interface VirusScanner {
  readonly name: string;
  readonly isEnabled: boolean;
  /** Throws when the scanner can't be reached or answers unexpectedly. */
  scan(data: Buffer): Promise<ScanResult>;
  /** Readiness check. */
  ping(): Promise<boolean>;
}

export const VIRUS_SCANNER = Symbol('VIRUS_SCANNER');

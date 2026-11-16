/** Where a request comes from (see @ClientInfoParam()). */
export interface ClientInfo {
  ipAddress: string;
  /** Raw User-Agent header, truncated; empty string if missing. */
  userAgent: string;
}

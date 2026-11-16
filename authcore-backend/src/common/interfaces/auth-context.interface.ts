/** Who is calling: set on the request by the authentication guard. */
export interface AuthContext {
  /** User id (JWT `sub`). */
  userId: string;
  /** Session id (JWT `sid`): the signed-in device. */
  sessionId: string;
  /** Access token id (JWT `jti`). */
  tokenId: string;
  /** USER or ADMIN (ADMIN passes every permission check). */
  role: string;
}

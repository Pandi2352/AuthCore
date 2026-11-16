import type { AuthContext } from '@common/interfaces/auth-context.interface';
import type { ClientInfo } from '@common/interfaces/client-info.interface';

/** Who is making an access-control change, and from where (for audit and escalation checks). */
export interface Actor {
  auth: AuthContext;
  client: ClientInfo;
}

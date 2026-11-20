/** GET /admin/activity item: one account event, with who it was. */
export interface ActivityEntry {
  id: string;
  userId: string;
  user: { id: string; email: string; firstName: string; lastName: string | null } | null;
  event: string;
  /** PASSWORD, EMAIL_CODE, EMAIL_LINK, ADMIN or NONE. */
  verificationType: string;
  isSuccess: boolean;
  occurredAt: string;
  deviceType: string | null;
  os: string | null;
  browser: string | null;
  ipAddress: string | null;
  sessionId: string | null;
  actorId: string | null;
  details: Record<string, unknown> | null;
}

/** GET /admin/activity/stats */
export interface ActivityStats {
  signIns24h: number;
  failedSignIns24h: number;
  activeUsers24h: number;
  signOuts24h: number;
  newDevices7d: number;
  lockouts7d: number;
  passwordChanges7d: number;
  totalEvents: number;
}

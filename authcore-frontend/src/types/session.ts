export interface Session {
  id: string;
  deviceName: string;
  deviceType: string;
  browser: string;
  os: string;
  ipAddress: string;
  lastIpAddress: string;
  signedInAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isPersistent: boolean;
  isCurrent: boolean;
}

export interface KnownDevice {
  id: string;
  deviceName: string;
  deviceType: string;
  browser: string;
  os: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastIpAddress: string;
}

export interface UserActivityEntry {
  id: string;
  userId: string;
  event: string;
  isSuccess: boolean;
  ipAddress: string;
  deviceType: string;
  browser: string;
  os: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

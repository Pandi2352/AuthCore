export enum SchedulerJob {
  PasswordExpiryNotification = 'PASSWORD_EXPIRY_NOTIFICATION',
}

export enum SchedulerFrequency {
  Hourly = 'HOURLY',
  Daily = 'DAILY',
  Weekly = 'WEEKLY',
  Monthly = 'MONTHLY',
}

export enum SchedulerExecutionStatus {
  Never = 'NEVER',
  Running = 'RUNNING',
  Success = 'SUCCESS',
  Failed = 'FAILED',
}

export enum NotificationStatus {
  Sent = 'SENT',
  Failed = 'FAILED',
}

export enum PolicyAuditAction {
  Create = 'CREATE',
  Update = 'UPDATE',
}

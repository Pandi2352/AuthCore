/** Active accounts without a sign-in for this many days count as "dormant" (user search). */
export const DORMANT_AFTER_DAYS = 30;

/** User activity buckets (the cards on the user search page). */
export const USER_ACTIVITIES = ['ACTIVE', 'DORMANT', 'INACTIVE'] as const;
export type UserActivity = (typeof USER_ACTIVITIES)[number];

/** Reports: most rows per file, how long the file is kept, how many reports a person keeps. */
export const REPORT_MAX_ROWS = 25_000;
export const REPORT_TTL_DAYS = 7;
export const REPORT_PAGE_SIZE = 1000;
export const REPORTS_KEPT_PER_USER = 20;

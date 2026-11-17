import type { BadgeTone } from './config.types';

/** One in-app notification shown in the navbar bell. */
export interface AppNotification {
  id: string;
  title: string;
  body?: string;
  /** ISO date-time. */
  createdAt: string;
  read: boolean;
  /** Internal path to open when clicked. */
  href?: string;
  tone?: BadgeTone;
}

/** What the navbar needs from a notification source (Level 2 / project). */
export interface NotificationFeed {
  items: readonly AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

import { useCallback, useMemo, useState } from 'react';

import type { AppNotification, NotificationFeed } from '@/types/notification.types';

/**
 * The navbar bell's data source — the one place to connect notifications.
 * Default: an in-memory, empty feed (the bell shows "You're all caught up").
 * Level 2 / your project: load from the API (e.g. TanStack Query + polling or SSE) and
 * return the same shape; nothing else in the navbar changes.
 */
export function useNotificationFeed(): NotificationFeed {
  const [items, setItems] = useState<AppNotification[]>([]);
  const markRead = useCallback(
    (id: string) => setItems((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n))),
    [],
  );
  const markAllRead = useCallback(
    () => setItems((list) => list.map((n) => ({ ...n, read: true }))),
    [],
  );
  return useMemo(
    () => ({
      items,
      unreadCount: items.filter((n) => !n.read).length,
      isLoading: false,
      markRead,
      markAllRead,
    }),
    [items, markRead, markAllRead],
  );
}

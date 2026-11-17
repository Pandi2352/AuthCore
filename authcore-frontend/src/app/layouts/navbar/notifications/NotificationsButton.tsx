import { Bell, BellOff, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  SkeletonText,
  Tooltip,
} from '@/components/ui';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

import { useNotificationFeed } from './use-notification-feed';

const TONE_DOT = {
  neutral: 'bg-muted-foreground',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
} as const;

/** Bell with unread count; popover lists notifications (feed from use-notification-feed.ts). */
export function NotificationsButton() {
  const { items, unreadCount, isLoading, markRead, markAllRead } = useNotificationFeed();
  const navigate = useNavigate();
  const label = unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications';

  return (
    <Popover>
      <Tooltip content="Notifications">
        <PopoverTrigger
          aria-label={label}
          className="relative inline-flex size-control-md cursor-pointer items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Bell className="size-4" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-1.5 right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-none font-semibold text-danger-foreground"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent
        align="end"
        className="w-[min(24rem,calc(100vw-1rem))] p-0"
        aria-label="Notifications"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<CheckCheck />}
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            Mark all as read
          </Button>
        </div>
        {isLoading ? (
          <SkeletonText lines={4} className="p-4" />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <BellOff className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
            <p className="text-xs text-muted-foreground">New notifications will appear here.</p>
          </div>
        ) : (
          <ScrollArea maxHeight="22rem" aria-label="Notification list">
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      markRead(item.id);
                      if (item.href) navigate(item.href);
                    }}
                    className={cn(
                      'flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent',
                      !item.read && 'bg-primary-soft/40',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        item.read ? 'bg-transparent' : TONE_DOT[item.tone ?? 'primary'],
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">
                        {item.title}
                        {!item.read && <span className="sr-only"> (unread)</span>}
                      </span>
                      {item.body && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {item.body}
                        </span>
                      )}
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}

import { Children, isValidElement, useState, type HTMLAttributes, type ReactElement } from 'react';

import { cn } from '@/lib/utils';

import { initialsOf } from './avatar-utils';

const SIZE = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-16 text-lg',
} as const;
const STATUS_SIZE = {
  xs: 'size-1.5',
  sm: 'size-2',
  md: 'size-2.5',
  lg: 'size-3',
  xl: 'size-3.5',
} as const;
const STATUS = {
  online: 'bg-success',
  away: 'bg-warning',
  busy: 'bg-danger',
  offline: 'bg-muted-foreground',
} as const;

export type AvatarSize = keyof typeof SIZE;

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string | null;
  /** Used for the alt text and the initials fallback. */
  name?: string | null;
  size?: AvatarSize;
  status?: keyof typeof STATUS;
}

/** Image with an initials fallback (also when the image fails to load) and an optional status dot. */
export function Avatar({ src, name, size = 'md', status, className, ...props }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  return (
    <span className={cn('relative inline-flex shrink-0', className)} {...props}>
      <span
        className={cn(
          'inline-flex items-center justify-center overflow-hidden rounded-full bg-primary-soft font-semibold text-primary-soft-foreground select-none',
          SIZE[size],
        )}
      >
        {showImage ? (
          <img
            src={src ?? undefined}
            alt={name ?? ''}
            className="size-full object-cover"
            onError={() => setFailedSrc(src ?? null)}
          />
        ) : (
          <span aria-label={name ?? undefined} role={name ? 'img' : undefined}>
            {initialsOf(name)}
          </span>
        )}
      </span>
      {status && (
        <span
          className={cn(
            'absolute right-0 bottom-0 rounded-full ring-2 ring-surface',
            STATUS[status],
            STATUS_SIZE[size],
          )}
          aria-label={status}
          role="img"
        />
      )}
    </span>
  );
}

export interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** Show at most this many; the rest become "+N". */
  max?: number;
  size?: AvatarSize;
  children: ReactElement<AvatarProps> | Array<ReactElement<AvatarProps>>;
}

/** Overlapping avatars with a "+N" counter. */
export function AvatarGroup({
  max = 4,
  size = 'sm',
  className,
  children,
  ...props
}: AvatarGroupProps) {
  const items = Children.toArray(children).filter(isValidElement) as Array<
    ReactElement<AvatarProps>
  >;
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <div className={cn('flex items-center -space-x-2', className)} {...props}>
      {shown.map((item, index) => (
        <Avatar
          key={item.key ?? index}
          {...item.props}
          size={size}
          className="rounded-full ring-2 ring-surface"
        />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-surface',
            SIZE[size],
          )}
          aria-label={`${rest} more`}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

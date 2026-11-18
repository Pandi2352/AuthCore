import type { EmojiIcon as EmojiIconData } from '@/config/emoji-icons';
import { cn } from '@/lib/utils';

/**
 * A full-color Fluent Emoji icon. The SVG content comes from our generated, build-time file
 * (scripts/build-emoji-icons.mjs), never from users or the network.
 */
export function EmojiIcon({
  icon,
  size = 18,
  className,
}: {
  icon: EmojiIconData;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${icon.size} ${icon.size}`}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
      // oxlint-disable-next-line react/no-danger -- trusted, generated at build time
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  );
}

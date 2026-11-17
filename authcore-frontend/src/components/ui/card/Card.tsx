import { Children, forwardRef, isValidElement, type HTMLAttributes, type ReactNode } from 'react';

import { useOptionalTheme } from '@/app/theme';
import { cn, variants } from '@/lib/utils';

const cardVariants = variants({
  base: 'flex flex-col overflow-hidden rounded-md text-surface-foreground',
  variants: {
    variant: {
      bordered: 'border border-border bg-surface',
      filled: 'border border-transparent bg-muted',
      elevated: 'border border-border bg-surface shadow-card',
      minimal: 'border border-transparent bg-transparent',
    },
  },
  defaultVariants: { variant: 'bordered' },
});

export type CardVariant = 'bordered' | 'filled' | 'elevated' | 'minimal';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Default: theme appearance.cards. */
  variant?: CardVariant;
  /** Shortcuts for a header / footer without composing the parts. */
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Right side of the header (buttons, menu). */
  actions?: ReactNode;
  footer?: ReactNode;
  /** Classes for the padded content area (spacing, alignment) — not the card's outer box. */
  contentClassName?: string;
}

/**
 * Surface for grouped content.
 * - Plain children are wrapped in a padded CardContent automatically (style it with
 *   contentClassName); title / subtitle / actions / footer add the header and footer.
 * - Or compose <CardHeader> / <CardContent> / <CardFooter> yourself (no automatic wrapper).
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant, title, subtitle, actions, footer, className, contentClassName, children, ...props },
  ref,
) {
  const theme = useOptionalTheme();
  const composed = Children.toArray(children).some(
    (child) => isValidElement(child) && CARD_PARTS.has(child.type),
  );
  return (
    <div
      ref={ref}
      className={cardVariants({
        variant: variant ?? theme?.appearance.cards ?? 'bordered',
        className,
      })}
      {...props}
    >
      {(title || subtitle || actions) && (
        <CardHeader className="border-b border-border">
          <div className="min-w-0 flex-1">
            {title && <CardTitle>{title}</CardTitle>}
            {subtitle && <CardDescription>{subtitle}</CardDescription>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </CardHeader>
      )}
      {composed ? children : <CardContent className={contentClassName}>{children}</CardContent>}
      {footer && <CardFooter className="border-t border-border bg-muted/60">{footer}</CardFooter>}
    </div>
  );
});

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-start gap-4 px-card py-4', className)} {...props} />;
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-base leading-tight font-semibold text-foreground', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1 text-sm text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex-1 p-card', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-end gap-3 px-card py-3', className)} {...props} />
  );
}

/** Parts that mean "the caller lays the card out itself". */
const CARD_PARTS = new Set<unknown>([CardHeader, CardContent, CardFooter]);

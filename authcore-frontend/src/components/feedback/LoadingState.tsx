import { Skeleton, SkeletonText, Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface LoadingStateProps {
  /** spinner: centered spinner + label · skeleton: text lines · cards: card grid · table: rows. */
  variant?: 'spinner' | 'skeleton' | 'cards' | 'table';
  /** Announced to screen readers and shown under the spinner. */
  label?: string;
  /** Lines / cards / rows. */
  count?: number;
  className?: string;
}

/** Placeholder while data loads. One live region announces the label; shapes are hidden. */
export function LoadingState({
  variant = 'spinner',
  label = 'Loading',
  count = 3,
  className,
}: LoadingStateProps) {
  return (
    <div aria-live="polite" aria-busy="true" className={cn('w-full', className)}>
      {variant === 'spinner' && (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-primary">
          <Spinner size="lg" label={null} />
          <p className="text-sm text-muted-foreground">{label}…</p>
        </div>
      )}
      {variant === 'skeleton' && (
        <>
          <span className="sr-only">{label}</span>
          <SkeletonText lines={count} />
        </>
      )}
      {variant === 'cards' && (
        <>
          <span className="sr-only">{label}</span>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {Array.from({ length: count }, (_card, i) => (
              <div key={i} className="space-y-3 rounded-md border border-border p-card">
                <Skeleton className="h-4 w-1/2" />
                <SkeletonText lines={2} />
              </div>
            ))}
          </div>
        </>
      )}
      {variant === 'table' && (
        <>
          <span className="sr-only">{label}</span>
          <div
            className="divide-y divide-border rounded-md border border-border"
            aria-hidden="true"
          >
            {Array.from({ length: count }, (_row, i) => (
              <div key={i} className="flex items-center gap-4 px-3 py-3">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

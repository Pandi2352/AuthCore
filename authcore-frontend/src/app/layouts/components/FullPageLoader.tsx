import { Spinner } from '@/components/ui';

/** Whole-screen loading state (first load, session check). */
export function FullPageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background text-primary">
      <Spinner size="lg" label={null} />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {label}…
      </p>
    </div>
  );
}

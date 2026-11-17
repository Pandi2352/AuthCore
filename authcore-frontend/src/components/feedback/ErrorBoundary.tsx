import { AlertTriangle, RotateCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui';
import { env } from '@/config';
import { cn } from '@/lib/utils';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * app: full-screen fallback with "Reload" (outermost, catches provider errors).
   * widget: small fallback in place of one card / panel; the rest of the page keeps working.
   */
  level?: 'app' | 'widget';
  /** Custom fallback; gets the error and a reset function. */
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
  /** Reset automatically when any of these change (e.g. the route path or an id). */
  resetKeys?: readonly unknown[];
  onError?: (error: Error, info: ErrorInfo) => void;
  className?: string;
}

interface State {
  error: Error | null;
  keys: readonly unknown[] | undefined;
}

const changed = (a: readonly unknown[] = [], b: readonly unknown[] = []) =>
  a.length !== b.length || a.some((item, i) => !Object.is(item, b[i]));

/**
 * Catches render errors below it. Route pages already have errorElement; use this for the
 * app shell (level="app") and for independent widgets (level="widget").
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  override state: State = { error: null, keys: this.props.resetKeys };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: State): Partial<State> | null {
    if (state.error && changed(props.resetKeys, state.keys))
      return { error: null, keys: props.resetKeys };
    if (props.resetKeys !== state.keys) return { keys: props.resetKeys };
    return null;
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (env.isDevelopment) console.error('ErrorBoundary caught:', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  reset = (): void => this.setState({ error: null });

  override render(): ReactNode {
    const { error } = this.state;
    const { children, level = 'widget', fallback, className } = this.props;
    if (!error) return children;
    if (fallback) return fallback({ error, reset: this.reset });

    if (level === 'app') {
      return (
        <div
          role="alert"
          className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground"
        >
          <AlertTriangle className="size-10 text-danger" aria-hidden="true" />
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            The application hit an unexpected error. Reloading usually fixes it.
          </p>
          <Button onClick={() => window.location.reload()} leftIcon={<RotateCw />}>
            Reload
          </Button>
          {env.isDevelopment && (
            <pre className="max-w-2xl overflow-auto rounded-md border border-border bg-muted p-4 text-left font-mono text-xs text-danger">
              {error.message}
            </pre>
          )}
        </div>
      );
    }

    return (
      <div
        role="alert"
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-md border border-danger/25 bg-danger-soft px-4 py-6 text-center text-sm text-danger-soft-foreground',
          className,
        )}
      >
        <p className="font-medium">This section couldn&apos;t be displayed.</p>
        {env.isDevelopment && <p className="font-mono text-xs">{error.message}</p>}
        <Button size="sm" variant="outline" leftIcon={<RotateCw />} onClick={this.reset}>
          Try again
        </Button>
      </div>
    );
  }
}

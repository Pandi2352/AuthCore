import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface Step {
  title: ReactNode;
  /** One line under the title. */
  description?: ReactNode;
  /** Mark the step as needing input (red *). */
  required?: boolean;
  content?: ReactNode;
}

/**
 * Numbered steps joined by a line (download the template → fill it in → upload). Each step
 * shows its number in a theme-colored circle, a title, an optional description and content.
 */
export function StepList({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <ol className={cn('relative', className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          // Steps are fixed and never reordered: the index is their identity.
          // oxlint-disable-next-line react/no-array-index-key
          <li key={index} className="relative flex gap-4 pb-8 last:pb-0">
            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute top-9 bottom-0 left-[1.0625rem] w-0.5 bg-primary/30"
              />
            )}
            <span
              aria-hidden="true"
              className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-card ring-4 ring-primary-soft"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 pt-1.5">
              <h3 className="text-base font-semibold text-foreground">
                <span className="sr-only">Step {index + 1}: </span>
                {step.title}
                {step.required && (
                  <span className="text-danger" aria-hidden="true">
                    {' '}
                    *
                  </span>
                )}
              </h3>
              {step.description && (
                <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
              )}
              {step.content && <div className="mt-3">{step.content}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

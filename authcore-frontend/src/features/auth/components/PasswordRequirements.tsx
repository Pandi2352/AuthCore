import { Check } from 'lucide-react';
import React, { useId } from 'react';

import { cn } from '@/lib/utils';

import { PASSWORD_CHECKS, passwordStrength, type StrengthLevel } from './password-checks';

interface PasswordRequirementsProps {
  password?: string;
  className?: string;
}

const LEVEL: Record<StrengthLevel, { label: string; text: string; bar: string }> = {
  empty: { label: 'Not set', text: 'text-muted-foreground', bar: 'bg-border' },
  weak: { label: 'Weak', text: 'text-danger', bar: 'bg-danger' },
  fair: { label: 'Fair', text: 'text-warning-soft-foreground', bar: 'bg-warning' },
  good: { label: 'Good', text: 'text-info', bar: 'bg-info' },
  strong: { label: 'Strong', text: 'text-success', bar: 'bg-success' },
  'very-strong': { label: 'Very strong', text: 'text-success', bar: 'bg-success' },
};

/**
 * Strength indicator where every segment is one rule: the segment lights up (in the overall
 * strength color) when its rule is met, with the rule's name right under it.
 */
export const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({
  password = '',
  className,
}) => {
  const id = useId();
  const { met, level } = passwordStrength(password);
  const tone = LEVEL[level];
  const total = PASSWORD_CHECKS.length;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span id={`${id}-title`} className="font-medium text-muted-foreground">
          Password strength
        </span>
        <span className={cn('font-semibold transition-colors', tone.text)} aria-live="polite">
          {tone.label}
        </span>
      </div>

      <meter
        className="sr-only"
        aria-labelledby={`${id}-title`}
        min={0}
        max={total}
        value={met}
        aria-valuetext={`${tone.label}: ${met} of ${total} requirements met`}
      />

      <ul aria-label="Password requirements" className="grid grid-cols-5 gap-1.5">
        {PASSWORD_CHECKS.map((check) => {
          const ok = check.test(password);
          return (
            <li key={check.word} title={check.label} className="min-w-0 space-y-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  'block h-1 rounded-md transition-colors duration-300',
                  ok ? tone.bar : 'bg-muted',
                )}
              />
              <span
                className={cn(
                  'flex items-center gap-1 text-xs whitespace-nowrap transition-colors',
                  ok ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                <Check
                  aria-hidden="true"
                  strokeWidth={3}
                  className={cn(
                    'size-3 shrink-0 transition-all duration-200',
                    ok ? 'text-success opacity-100' : 'w-0 opacity-0',
                  )}
                />
                <span className="truncate sm:hidden" aria-hidden="true">
                  {check.short}
                </span>
                <span className="hidden truncate sm:inline" aria-hidden="true">
                  {check.word}
                </span>
                <span className="sr-only">
                  {check.label} {ok ? '(met)' : '(not met)'}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

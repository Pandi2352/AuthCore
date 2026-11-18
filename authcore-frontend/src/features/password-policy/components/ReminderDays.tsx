import { Plus, X } from 'lucide-react';
import { useId, useState } from 'react';

import { Button, Input } from '@/components/ui';

import { POLICY_LIMITS } from '../types/password-policy.types';
import { CustomRow } from './PolicyControls';

/** "Remind the user N days before the password expires" — up to five values. */
export function ReminderDays({
  days,
  validityDays,
  disabled,
  error,
  onChange,
}: {
  days: number[];
  validityDays: number;
  disabled?: boolean;
  error?: string;
  onChange: (days: number[]) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const value = Number(draft);
  const isFull = days.length >= POLICY_LIMITS.maxNotificationDays;
  const canAdd =
    !isFull &&
    draft !== '' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value < validityDays &&
    !days.includes(value);

  const add = () => {
    if (!canAdd) return;
    onChange([...days, value].toSorted((a, b) => b - a));
    setDraft('');
  };

  return (
    <CustomRow
      label="Reminder emails"
      hint={`Days before expiry (up to ${POLICY_LIMITS.maxNotificationDays})`}
      htmlFor={id}
      error={error}
    >
      <div className="flex flex-wrap items-center gap-2">
        {days.length === 0 && <span className="text-xs text-muted-foreground">No reminders</span>}
        {days.map((day) => (
          <span
            key={day}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-muted pr-1 pl-2.5 text-xs font-medium text-foreground"
          >
            {day} {day === 1 ? 'day' : 'days'}
            <button
              type="button"
              disabled={disabled}
              aria-label={`Remove the ${day}-day reminder`}
              onClick={() => onChange(days.filter((d) => d !== day))}
              className="flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        ))}
        {!isFull && (
          <div className="flex items-center gap-1.5">
            <Input
              id={id}
              type="number"
              size="sm"
              min={1}
              max={validityDays - 1}
              value={draft}
              disabled={disabled}
              placeholder="Days"
              aria-label="Days before expiry"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
              className="w-20 tabular-nums"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<Plus />}
              disabled={disabled || !canAdd}
              onClick={add}
            >
              Add
            </Button>
          </div>
        )}
      </div>
    </CustomRow>
  );
}

import { Check, Plus, X } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * The "+ Add …" row at the bottom of a select's list. Click → a small name field; Enter / ✓
 * calls `onCreate`, Escape closes the list.
 */
export function ListboxCreate({
  label,
  placeholder,
  onCreate,
}: {
  /** e.g. "Add category" */
  label: string;
  placeholder: string;
  /** Resolves with null when added, or with a message to show under the field. */
  onCreate: (text: string) => Promise<string | null>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const submit = async () => {
    const value = text.trim();
    if (!value || isBusy) return;
    setIsBusy(true);
    setError(null);
    const problem = await onCreate(value).catch(() => 'Could not add it. Please try again.');
    if (problem) {
      setError(problem);
      setIsBusy(false);
    }
  };

  if (!isEditing) {
    return (
      <button
        type="button"
        data-listbox-create=""
        onClick={() => setIsEditing(true)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left font-medium text-primary hover:bg-primary-soft focus-visible:bg-primary-soft focus-visible:outline-none pointer-coarse:py-2.5"
      >
        <Plus className="size-4 shrink-0" aria-hidden="true" />
        {label}
      </button>
    );
  }

  return (
    // A div, not a form: the select may itself sit inside a form.
    <div className="space-y-1 p-1">
      <div className="flex items-center gap-1.5">
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the user just asked to type a name
          autoFocus
          data-listbox-create=""
          value={text}
          maxLength={40}
          placeholder={placeholder}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
          }}
          className={cn(
            'h-8 min-w-0 flex-1 rounded-md border bg-surface px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary',
            error ? 'border-danger' : 'border-border',
          )}
        />
        <button
          type="button"
          aria-label={`Save: ${label}`}
          disabled={!text.trim() || isBusy}
          onClick={() => void submit()}
          className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className={cn('size-4', isBusy && 'animate-pulse')} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Cancel"
          onClick={() => {
            setIsEditing(false);
            setText('');
            setError(null);
          }}
          className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      {error && (
        <p role="alert" className="px-0.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

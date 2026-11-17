import { BookOpen, ChevronRight } from 'lucide-react';

import { CopyButton } from '@/components/common/CopyButton';

import type { UsageNote } from './kitchen-sink-notes';

/** Collapsible "Usage" block under a kitchen-sink section: when to use what, rules, example. */
export function UsageNotes({ note }: { note: UsageNote }) {
  return (
    <details className="group rounded-md border border-border bg-muted/40 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-4 py-2.5 font-medium text-foreground select-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="size-4 text-muted-foreground transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
        <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
        Usage
      </summary>
      <div className="space-y-4 border-t border-border px-4 py-4">
        <div>
          <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            When to use
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-foreground">
            {note.when.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        {note.rules && note.rules.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Rules
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-foreground">
              {note.rules.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Example
            </h3>
            <CopyButton value={note.example} label="Copy example" size="sm" />
          </div>
          <pre className="overflow-x-auto rounded-md border border-border bg-surface p-3 font-mono text-xs leading-relaxed text-foreground">
            <code>{note.example}</code>
          </pre>
        </div>
      </div>
    </details>
  );
}

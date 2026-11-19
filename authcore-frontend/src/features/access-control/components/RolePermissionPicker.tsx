import { ChevronDown, Search, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge, Checkbox, Input, Switch } from '@/components/ui';
import { cn } from '@/lib/utils';

import type { Permission } from '../types/access-control.types';

interface ModuleGroup {
  id: string;
  label: string;
  /** Index into MODULE_TONES (by position in the full list, so it stays put while filtering). */
  tone: number;
  permissions: Permission[];
}

const ACTION_TONE: Record<
  string,
  'info' | 'success' | 'warning' | 'danger' | 'primary' | 'neutral'
> = {
  READ: 'info',
  CREATE: 'success',
  UPDATE: 'warning',
  DELETE: 'danger',
  MANAGE: 'primary',
};

/** One light color per module (full class names so Tailwind generates them). */
const MODULE_TONES = [
  {
    box: 'border-info/30 border-l-info',
    boxOn: 'border-info/60',
    head: 'bg-info-soft/60',
    text: 'text-info-soft-foreground',
    dot: 'bg-info',
  },
  {
    box: 'border-success/30 border-l-success',
    boxOn: 'border-success/60',
    head: 'bg-success-soft/60',
    text: 'text-success-soft-foreground',
    dot: 'bg-success',
  },
  {
    box: 'border-nav-violet/30 border-l-nav-violet',
    boxOn: 'border-nav-violet/60',
    head: 'bg-nav-violet/10',
    text: 'text-nav-violet',
    dot: 'bg-nav-violet',
  },
  {
    box: 'border-warning/35 border-l-warning',
    boxOn: 'border-warning/70',
    head: 'bg-warning-soft/60',
    text: 'text-warning-soft-foreground',
    dot: 'bg-warning',
  },
  {
    box: 'border-nav-cyan/30 border-l-nav-cyan',
    boxOn: 'border-nav-cyan/60',
    head: 'bg-nav-cyan/10',
    text: 'text-nav-cyan',
    dot: 'bg-nav-cyan',
  },
  {
    box: 'border-primary/30 border-l-primary',
    boxOn: 'border-primary/60',
    head: 'bg-primary-soft/60',
    text: 'text-primary-soft-foreground',
    dot: 'bg-primary',
  },
  {
    box: 'border-danger/30 border-l-danger',
    boxOn: 'border-danger/60',
    head: 'bg-danger-soft/60',
    text: 'text-danger-soft-foreground',
    dot: 'bg-danger',
  },
] as const;

const metaValue = (p: Permission, key: string) => p.metadata.find((m) => m.key === key);

/** "access-control" → "Access control". */
const moduleLabel = (id: string) =>
  id === 'other' ? 'Other' : (id.charAt(0).toUpperCase() + id.slice(1)).replaceAll('-', ' ');

/** Permissions grouped by their `module` metadata (as the backend defines them). */
function groupByModule(permissions: Permission[]): ModuleGroup[] {
  const groups = new Map<string, Permission[]>();
  for (const p of permissions) {
    const id = metaValue(p, 'module')?.value ?? 'other';
    groups.set(id, [...(groups.get(id) ?? []), p]);
  }
  return [...groups.entries()]
    .map(([id, items]) => ({ id, label: moduleLabel(id), permissions: items, tone: 0 }))
    .toSorted((a, b) =>
      a.id === 'other' ? 1 : b.id === 'other' ? -1 : a.label.localeCompare(b.label),
    )
    .map((m, index) => Object.assign(m, { tone: index % MODULE_TONES.length }));
}

/**
 * Pick the permissions a role grants: grouped by module, select-all per module, search,
 * "selected only". Read-only for built-in roles.
 */
export function RolePermissionPicker({
  permissions,
  selected,
  onChange,
  readOnly = false,
  defaultSelectedOnly = false,
  error,
}: {
  permissions: Permission[];
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  readOnly?: boolean;
  /** Start with only the ticked permissions shown (e.g. a read-only view). */
  defaultSelectedOnly?: boolean;
  error?: string;
}) {
  const [query, setQuery] = useState('');
  const [isSelectedOnly, setIsSelectedOnly] = useState(defaultSelectedOnly);
  // Modules start collapsed; a search opens the ones with matches.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const modules = useMemo(() => groupByModule(permissions), [permissions]);

  const q = query.trim().toLowerCase();
  const visible = modules
    .map((m) => ({
      id: m.id,
      label: m.label,
      tone: MODULE_TONES[m.tone] ?? MODULE_TONES[0],
      permissions: m.permissions,
      shown: m.permissions.filter(
        (p) =>
          (!isSelectedOnly || selected.has(p.id)) &&
          (!q ||
            p.permissionName.toLowerCase().includes(q) ||
            p.permissionKey.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            m.label.toLowerCase().includes(q)),
      ),
    }))
    .filter((m) => m.shown.length > 0);

  const toggle = (ids: string[], on: boolean) => {
    const next = new Set(selected);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    onChange(next);
  };
  const toggleOpen = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          size="sm"
          value={query}
          placeholder="Search permissions by name, key or module"
          aria-label="Search permissions"
          prefix={<Search className="size-3.5 text-muted-foreground" aria-hidden="true" />}
          wrapperClassName="sm:flex-1"
          onChange={(e) => setQuery(e.target.value)}
        />
        <Switch
          size="sm"
          label="Selected only"
          checked={isSelectedOnly}
          onCheckedChange={setIsSelectedOnly}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
          {selected.size} of {permissions.length} selected
        </span>
        {!readOnly && selected.size > 0 && (
          <button
            type="button"
            className="cursor-pointer rounded-md text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() => onChange(new Set())}
          >
            Clear all
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}

      <div className="space-y-2">
        {visible.map((m) => {
          const ids = m.permissions.map((p) => p.id);
          const chosen = ids.filter((id) => selected.has(id)).length;
          const isOpen = q !== '' || expanded.has(m.id);
          return (
            <section
              key={m.id}
              aria-label={m.label}
              className={cn(
                'overflow-hidden rounded-md border border-l-4 bg-surface transition-colors',
                m.tone.box,
                chosen > 0 && m.tone.boxOn,
              )}
            >
              <header className={cn('flex items-center gap-3 px-3 py-2.5', m.tone.head)}>
                <Checkbox
                  aria-label={`Select every ${m.label} permission`}
                  checked={chosen === ids.length}
                  indeterminate={chosen > 0 && chosen < ids.length}
                  disabled={readOnly}
                  onCheckedChange={(checked) => toggle(ids, checked)}
                />
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggleOpen(m.id)}
                  className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-md text-left focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn('size-2 shrink-0 rounded-full', m.tone.dot)}
                      aria-hidden="true"
                    />
                    <span className={cn('truncate text-sm font-semibold', m.tone.text)}>
                      {m.label}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge size="sm" tone={chosen > 0 ? 'primary' : 'neutral'}>
                      {chosen}/{ids.length}
                    </Badge>
                    <ChevronDown
                      className={cn(
                        'size-4 text-muted-foreground transition-transform motion-reduce:transition-none',
                        isOpen && 'rotate-180',
                      )}
                      aria-hidden="true"
                    />
                  </span>
                </button>
              </header>
              {isOpen && (
                <ul className={cn('divide-y divide-border border-t', m.tone.box)}>
                  {m.shown.map((p) => {
                    const action = metaValue(p, 'module')?.action ?? '';
                    return (
                      <li key={p.id} className="flex items-start gap-3 px-3 py-2.5">
                        <Checkbox
                          aria-label={p.permissionName}
                          checked={selected.has(p.id)}
                          disabled={readOnly}
                          onCheckedChange={(checked) => toggle([p.id], checked)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm text-foreground">{p.permissionName}</span>
                            {action && (
                              <Badge
                                size="sm"
                                tone={ACTION_TONE[action] ?? 'neutral'}
                                variant="outline"
                              >
                                {action.charAt(0) + action.slice(1).toLowerCase()}
                              </Badge>
                            )}
                          </div>
                          {p.description && (
                            <p className="text-xs text-muted-foreground">{p.description}</p>
                          )}
                          <code className="font-mono text-[11px] text-muted-foreground">
                            {p.permissionKey}
                          </code>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
        {visible.length === 0 && (
          <p className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
            {isSelectedOnly && selected.size === 0
              ? 'No permissions selected yet.'
              : 'No permissions match your search.'}
          </p>
        )}
      </div>
    </div>
  );
}

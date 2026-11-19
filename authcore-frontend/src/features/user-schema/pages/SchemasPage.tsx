import {
  Braces,
  FilterX,
  FolderPlus,
  Layers,
  Plus,
  RefreshCw,
  Sparkles,
  ToggleRight,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { SearchInput } from '@/components/common/SearchInput';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import { Alert, Button, Select } from '@/components/ui';
import { usePermissions } from '@/features/auth';
import { isAbortError } from '@/lib/api';

import { userSchemaApi } from '../api/user-schema.api';
import {
  buildRows,
  DATA_TYPES,
  hasFilters,
  NO_FILTERS,
  type SchemaFilters,
  type SourceFilter,
  type StatusFilter,
  type TypeFilter,
} from '../components/schema-meta';
import { SchemaTable } from '../components/SchemaTable';
import { VariableFormSheet, type VariableSheetTarget } from '../components/VariableFormSheet';
import type { AttributeDataType, SchemaAttribute, SchemaOptions } from '../types/user-schema.types';

interface Loaded {
  key: number;
  attributes: SchemaAttribute[];
  options: SchemaOptions;
}

const TYPE_FILTERS = [
  { value: 'all', label: 'All types' },
  { value: 'GROUP', label: 'Groups' },
  ...(Object.keys(DATA_TYPES) as AttributeDataType[]).map((type) => ({
    value: type,
    label: DATA_TYPES[type].label,
  })),
];

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground [&_svg]:size-5">
        {icon}
      </span>
      <div>
        <p className="text-2xl leading-none font-semibold text-foreground tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/** Administration → Security settings → Schemas: the custom user variables. */
export function SchemasPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('USER_SCHEMA_MANAGE');
  const [nonce, setNonce] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<{ key: number; error: unknown } | null>(null);
  const [filters, setFilters] = useState<SchemaFilters>(NO_FILTERS);
  const [sheet, setSheet] = useState<{ open: boolean; target: VariableSheetTarget; key: number }>({
    open: false,
    target: { kind: 'FIELD', editing: null, parentId: null },
    key: 0,
  });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const [attributes, options] = await Promise.all([
          userSchemaApi.list(controller.signal),
          userSchemaApi.options(controller.signal),
        ]);
        setLoaded({ key: nonce, attributes, options });
      } catch (error) {
        if (!isAbortError(error)) setFailure({ key: nonce, error });
      }
    };
    void load();
    return () => controller.abort();
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const openSheet = (target: VariableSheetTarget) =>
    setSheet((s) => ({ open: true, target, key: s.key + 1 }));

  const attributes = useMemo(() => loaded?.attributes ?? [], [loaded]);
  const rows = useMemo(() => buildRows(attributes, filters), [attributes, filters]);
  const groups = useMemo(
    () => attributes.filter((a) => a.kind === 'GROUP' && !a.parentId),
    [attributes],
  );
  const knownScopes = useMemo(
    () => [...new Set(attributes.flatMap((a) => a.scopes))],
    [attributes],
  );
  const isFiltered = hasFilters(filters);
  const shownCount = rows.reduce((n, r) => n + 1 + r.children.length, 0);

  const upsert = (saved: SchemaAttribute) =>
    setLoaded((current) => {
      if (!current) return current;
      const exists = current.attributes.some((a) => a.id === saved.id);
      return {
        ...current,
        attributes: exists
          ? current.attributes.map((a) => (a.id === saved.id ? saved : a))
          : [...current.attributes, saved],
      };
    });
  const removeLocal = (id: string) =>
    setLoaded((current) =>
      current ? { ...current, attributes: current.attributes.filter((a) => a.id !== id) } : current,
    );

  const isFirstLoad = !loaded && failure?.key !== nonce;

  return (
    <PageContainer>
      <PageHeader
        title="Schemas - Custom User Variables"
        description="Allows users to dynamically add custom user information fields based on specific requirements, supporting a variety of data types such as Text, Email, Mobile, Number, Dropdown List, and more, offering unparalleled customization and flexibility."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 whitespace-nowrap"
              leftIcon={<RefreshCw />}
              onClick={reload}
            >
              Refresh
            </Button>
            {canManage && loaded && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 whitespace-nowrap"
                  leftIcon={<FolderPlus />}
                  onClick={() => openSheet({ kind: 'GROUP', editing: null, parentId: null })}
                >
                  Create group
                </Button>
                <Button
                  size="sm"
                  className="shrink-0 whitespace-nowrap"
                  leftIcon={<Plus />}
                  onClick={() => openSheet({ kind: 'FIELD', editing: null, parentId: null })}
                >
                  Create variable
                </Button>
              </>
            )}
          </div>
        }
      />

      {isFirstLoad && <LoadingState variant="table" label="Loading the user schema" />}
      {!loaded && failure?.key === nonce && (
        <ErrorState error={failure.error} title="Could not load the user schema" onRetry={reload} />
      )}

      {loaded && (
        <div className="space-y-6">
          {!canManage && (
            <Alert
              variant="info"
              title="View only"
              message="Changing variables needs the Manage user schema permission."
            />
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              icon={<Braces />}
              label="Variables"
              value={attributes.filter((a) => a.kind === 'FIELD').length}
            />
            <Stat
              icon={<Layers />}
              label="Groups"
              value={attributes.filter((a) => a.kind === 'GROUP').length}
            />
            <Stat
              icon={<Sparkles />}
              label="Custom"
              value={attributes.filter((a) => !a.isSystem).length}
            />
            <Stat
              icon={<ToggleRight />}
              label="Enabled"
              value={attributes.filter((a) => a.isEnabled).length}
            />
          </div>

          <section
            aria-label="Variables"
            className="overflow-hidden rounded-md border border-border bg-surface"
          >
            <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
              <SearchInput
                size="toolbar"
                value={filters.search}
                onSearch={(search) => setFilters((f) => ({ ...f, search }))}
                placeholder="Search by name, label or description"
                aria-label="Search variables"
                className="lg:max-w-sm lg:flex-1"
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:items-center">
                <Select
                  aria-label="Type"
                  size="toolbar"
                  value={filters.type}
                  options={TYPE_FILTERS}
                  className="lg:w-40"
                  onValueChange={(type) =>
                    setFilters((f) => ({ ...f, type: (type ?? 'all') as TypeFilter }))
                  }
                />
                <Select
                  aria-label="Source"
                  size="toolbar"
                  value={filters.source}
                  options={[
                    { value: 'all', label: 'System & custom' },
                    { value: 'system', label: 'System only' },
                    { value: 'custom', label: 'Custom only' },
                  ]}
                  className="lg:w-40"
                  onValueChange={(source) =>
                    setFilters((f) => ({ ...f, source: (source ?? 'all') as SourceFilter }))
                  }
                />
                <Select
                  aria-label="Status"
                  size="toolbar"
                  value={filters.status}
                  options={[
                    { value: 'all', label: 'Any status' },
                    { value: 'enabled', label: 'Enabled' },
                    { value: 'disabled', label: 'Disabled' },
                  ]}
                  className="lg:w-36"
                  onValueChange={(status) =>
                    setFilters((f) => ({ ...f, status: (status ?? 'all') as StatusFilter }))
                  }
                />
              </div>
              <div className="flex items-center gap-3 lg:ml-auto">
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {isFiltered
                    ? `${shownCount} of ${attributes.length} shown`
                    : `${attributes.length} in total`}
                </p>
                {isFiltered && (
                  <Button
                    variant="ghost"
                    size="toolbar"
                    leftIcon={<FilterX />}
                    onClick={() => setFilters(NO_FILTERS)}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {rows.length === 0 ? (
              <EmptyState
                size="compact"
                className="py-12"
                icon={isFiltered ? <FilterX /> : <Braces />}
                title={isFiltered ? 'No variables match' : 'No variables yet'}
                description={
                  isFiltered
                    ? 'Try another search or clear the filters.'
                    : 'Create a variable to collect extra information about your users.'
                }
                action={
                  isFiltered ? (
                    <Button variant="outline" size="sm" onClick={() => setFilters(NO_FILTERS)}>
                      Clear filters
                    </Button>
                  ) : canManage ? (
                    <Button
                      size="sm"
                      leftIcon={<Plus />}
                      onClick={() => openSheet({ kind: 'FIELD', editing: null, parentId: null })}
                    >
                      Create variable
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <SchemaTable
                rows={rows}
                forceExpanded={isFiltered}
                actions={{
                  canManage,
                  onEdit: (attribute) =>
                    openSheet({
                      kind: attribute.kind,
                      editing: attribute,
                      parentId: attribute.parentId,
                    }),
                  onAddChild: (group) =>
                    openSheet({ kind: 'FIELD', editing: null, parentId: group.id }),
                  onSaved: upsert,
                  onDeleted: removeLocal,
                }}
              />
            )}
          </section>

          <VariableFormSheet
            key={sheet.key}
            open={sheet.open}
            onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
            target={sheet.target}
            groups={groups}
            schemaOptions={loaded.options}
            knownScopes={knownScopes}
            onSaved={upsert}
          />
        </div>
      )}
    </PageContainer>
  );
}

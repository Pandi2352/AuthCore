import { Check, Plus, X } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';

import { notifyError, notifySuccess } from '@/components/feedback';
import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  Input,
  Select,
  Switch,
  Textarea,
} from '@/components/ui';
import { getFieldErrors } from '@/lib/api';
import { cn } from '@/lib/utils';

import { userSchemaApi } from '../api/user-schema.api';
import type {
  AttributeDataType,
  AttributeGroupType,
  AttributeKind,
  AttributeMutability,
  AttributeReturned,
  CreateAttributeRequest,
  SchemaAttribute,
  SchemaOptions,
  UpdateAttributeRequest,
} from '../types/user-schema.types';
import {
  DATA_TYPES,
  GROUP_ICON,
  GROUP_TYPES,
  LENGTH_TYPES,
  NAME_PATTERN,
  OPTION_TYPES,
  SCOPE_PATTERN,
  toSnakeCase,
  USERNAME_TYPES,
} from './schema-meta';

/** What the sheet is for: a new variable / group (optionally inside a group) or an edit. */
export interface VariableDialogTarget {
  kind: AttributeKind;
  editing: SchemaAttribute | null;
  parentId: string | null;
}

interface OptionRow {
  key: number;
  label: string;
  value: string;
  /** The value was typed by hand (stop deriving it from the label). */
  isValueTouched: boolean;
}

interface FormValues {
  label: string;
  name: string;
  description: string;
  dataType: AttributeDataType | null;
  groupType: AttributeGroupType;
  parentId: string | null;
  options: OptionRow[];
  minLength: string;
  maxLength: string;
  min: string;
  max: string;
  scopes: string[];
  locales: string[];
  isEnabled: boolean;
  isRequired: boolean;
  isInternal: boolean;
  isUnique: boolean;
  isUsername: boolean;
  includeInToken: boolean;
  includeInSearchFilter: boolean;
  mutability: AttributeMutability;
  returned: AttributeReturned;
}

const numberText = (value: number | null) => (value === null ? '' : String(value));
let optionKey = 0;

function initialValues(target: VariableDialogTarget): FormValues {
  const a = target.editing;
  return {
    label: a?.label ?? '',
    name: a?.name ?? '',
    description: a?.description ?? '',
    dataType: a?.dataType ?? (target.kind === 'FIELD' ? 'TEXT' : null),
    groupType: a?.groupType ?? 'OBJECT',
    parentId: a?.parentId ?? target.parentId,
    options: (a?.options ?? []).map((o) => ({
      key: (optionKey += 1),
      label: o.label,
      value: o.value,
      isValueTouched: true,
    })),
    minLength: numberText(a?.minLength ?? null),
    maxLength: numberText(a?.maxLength ?? null),
    min: numberText(a?.min ?? null),
    max: numberText(a?.max ?? null),
    scopes: a?.scopes ?? ['profile'],
    locales: a?.locales ?? ['en'],
    isEnabled: a?.isEnabled ?? true,
    isRequired: a?.isRequired ?? false,
    isInternal: a?.isInternal ?? false,
    isUnique: a?.isUnique ?? false,
    isUsername: a?.isUsername ?? false,
    includeInToken: a?.includeInToken ?? false,
    includeInSearchFilter: a?.includeInSearchFilter ?? false,
    mutability: a?.mutability ?? 'READ_WRITE',
    returned: a?.returned ?? 'DEFAULT',
  };
}

const toNumber = (text: string): number | undefined =>
  text.trim() === '' ? undefined : Number(text);

function validate(v: FormValues, kind: AttributeKind, isEdit: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!v.label.trim()) errors.label = 'Enter a label';
  if (!isEdit && !NAME_PATTERN.test(v.name))
    errors.name = 'Use 2–50 lowercase letters, digits or _, starting with a letter';
  if (kind === 'FIELD' && v.dataType && OPTION_TYPES.includes(v.dataType)) {
    const filled = v.options.filter((o) => o.label.trim() || o.value.trim());
    if (filled.length === 0) errors.options = 'Add at least one option';
    else if (filled.some((o) => !o.label.trim() || !o.value.trim()))
      errors.options = 'Every option needs a label and a value';
    else if (new Set(filled.map((o) => o.value.trim())).size !== filled.length)
      errors.options = 'Option values must be different';
  }
  const minLength = toNumber(v.minLength);
  const maxLength = toNumber(v.maxLength);
  if (minLength !== undefined && maxLength !== undefined && minLength > maxLength)
    errors.minLength = 'The minimum can’t be more than the maximum';
  const min = toNumber(v.min);
  const max = toNumber(v.max);
  if (min !== undefined && max !== undefined && min > max)
    errors.min = 'The lowest value can’t be more than the highest';
  if (v.scopes.length === 0) errors.scopes = 'Select at least one scope';
  if (v.locales.length === 0) errors.locales = 'Select at least one locale';
  return errors;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3 rounded-md border border-border p-4">
      <header>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

/** Toggle chips (scopes, locales). */
function ChipPicker({
  label,
  options,
  selected,
  disabled,
  error,
  onChange,
  addon,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  disabled?: boolean;
  error?: string;
  onChange: (next: string[]) => void;
  addon?: ReactNode;
}) {
  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="mb-1.5 text-sm font-medium text-foreground">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isOn = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isOn}
              onClick={() =>
                onChange(
                  isOn ? selected.filter((s) => s !== option.value) : [...selected, option.value],
                )
              }
              className={cn(
                'inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60',
                isOn
                  ? 'border-primary bg-primary-soft text-primary-soft-foreground'
                  : 'border-border bg-surface text-muted-foreground hover:border-field hover:text-foreground',
              )}
            >
              {isOn && <Check className="size-3.5" aria-hidden="true" />}
              {option.label}
            </button>
          );
        })}
        {addon}
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function VariableFormDialog({
  open,
  onOpenChange,
  target,
  groups,
  schemaOptions,
  knownScopes,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: VariableDialogTarget;
  /** Top-level groups a new variable can go into. */
  groups: SchemaAttribute[];
  schemaOptions: SchemaOptions;
  /** Scopes already in use (custom ones are offered too). */
  knownScopes: string[];
  onSaved: (attribute: SchemaAttribute) => void;
}) {
  const editing = target.editing;
  const isEdit = editing !== null;
  const isSystem = editing?.isSystem ?? false;
  const kind = editing?.kind ?? target.kind;
  const [values, setValues] = useState<FormValues>(() => initialValues(target));
  const [isNameTouched, setIsNameTouched] = useState(isEdit);
  const [hasTried, setHasTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [scopeDraft, setScopeDraft] = useState('');

  const clientErrors = validate(values, kind, isEdit);
  const errors = { ...(hasTried ? clientErrors : {}), ...serverErrors };
  const set = (change: Partial<FormValues>) => {
    setValues((current) => ({ ...current, ...change }));
    if (Object.keys(serverErrors).length > 0) setServerErrors({});
  };

  const dataType = values.dataType;
  const hasLength = kind === 'FIELD' && dataType !== null && LENGTH_TYPES.includes(dataType);
  const hasRange = kind === 'FIELD' && dataType === 'NUMBER';
  const hasOptions = kind === 'FIELD' && dataType !== null && OPTION_TYPES.includes(dataType);
  const canBeUsername = kind === 'FIELD' && dataType !== null && USERNAME_TYPES.includes(dataType);
  // System variables: only labels, scopes, locales and token / search flags change.
  const structureLocked = isSystem;

  const scopeOptions = [
    ...new Set([...schemaOptions.scopes.map((s) => s.value), ...knownScopes, ...values.scopes]),
  ].map((value) => ({ value, label: value }));
  const addScope = () => {
    const scope = scopeDraft.trim().toLowerCase();
    if (!SCOPE_PATTERN.test(scope)) return;
    if (!values.scopes.includes(scope)) set({ scopes: [...values.scopes, scope] });
    setScopeDraft('');
  };

  const setOption = (key: number, change: Partial<OptionRow>) =>
    set({
      options: values.options.map((o) => {
        if (o.key !== key) return o;
        const next = { ...o, ...change };
        if (change.label !== undefined && !o.isValueTouched) next.value = toSnakeCase(change.label);
        return next;
      }),
    });

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setHasTried(true);
    if (Object.keys(clientErrors).length > 0) return;
    setIsSaving(true);
    const options = hasOptions
      ? values.options
          .filter((o) => o.label.trim())
          .map((o) => ({ label: o.label.trim(), value: o.value.trim() }))
      : undefined;
    const common = {
      label: values.label.trim(),
      description: values.description.trim(),
      scopes: values.scopes,
      locales: values.locales,
      includeInToken: values.includeInToken,
      includeInSearchFilter: values.includeInSearchFilter,
    };
    const behaviour = {
      options,
      minLength: hasLength ? toNumber(values.minLength) : undefined,
      maxLength: hasLength ? toNumber(values.maxLength) : undefined,
      min: hasRange ? toNumber(values.min) : undefined,
      max: hasRange ? toNumber(values.max) : undefined,
      isEnabled: values.isEnabled,
      isRequired: values.isRequired,
      isInternal: values.isInternal,
      isUnique: values.isUnique || values.isUsername,
      isUsername: canBeUsername ? values.isUsername : false,
      mutability: values.mutability,
      returned: values.returned,
    };
    try {
      let saved: SchemaAttribute;
      if (editing) {
        const body: UpdateAttributeRequest = isSystem
          ? { ...common, version: editing.version }
          : { ...common, ...behaviour, version: editing.version };
        saved = await userSchemaApi.update(editing.id, body);
      } else {
        const body: CreateAttributeRequest = {
          ...common,
          ...behaviour,
          name: values.name,
          kind,
          ...(kind === 'FIELD'
            ? { dataType: values.dataType ?? 'TEXT' }
            : { groupType: values.groupType }),
          ...(values.parentId ? { parentId: values.parentId } : {}),
        };
        saved = await userSchemaApi.create(body);
      }
      onSaved(saved);
      notifySuccess(
        isEdit ? `${saved.label} updated` : `${saved.label} created`,
        isEdit
          ? undefined
          : {
              description:
                kind === 'GROUP'
                  ? 'Add variables inside it from its ⋯ menu.'
                  : 'It now appears in profile forms.',
            },
      );
      onOpenChange(false);
    } catch (err) {
      setServerErrors(getFieldErrors(err));
      notifyError(err, isEdit ? 'Could not save the changes' : 'Could not create it');
    } finally {
      setIsSaving(false);
    }
  };

  const noun = kind === 'GROUP' ? 'group' : 'variable';
  const parentGroup = groups.find((g) => g.id === values.parentId) ?? null;
  const title = isEdit
    ? `Edit ${editing.label}`
    : parentGroup
      ? `New variable in ${parentGroup.label}`
      : `Create ${noun}`;
  const description =
    kind === 'GROUP'
      ? 'A group keeps related variables together, like an address with street, city and postal code.'
      : 'A custom field stored on every user profile.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description} size="xl">
        <form noValidate onSubmit={(e) => void save(e)} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-5">
            {isSystem && (
              <Alert
                variant="info"
                title="Standard OpenID Connect variable"
                message="Its name, type and security rules are fixed. You can change the label, description, scopes, locales and token / search options."
              />
            )}

            <Section title="Basics">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Label"
                  required
                  maxLength={100}
                  value={values.label}
                  placeholder={kind === 'GROUP' ? 'Enter a group label' : 'Enter a label'}
                  hint="Shown to people in forms"
                  error={errors.label}
                  onChange={(e) => {
                    const label = e.target.value;
                    set(isNameTouched ? { label } : { label, name: toSnakeCase(label) });
                  }}
                />
                <Input
                  label="Name"
                  required
                  maxLength={50}
                  value={values.name}
                  disabled={isEdit}
                  placeholder="Enter a snake_case name"
                  hint={isEdit ? 'Fixed after creation' : 'Key in the API and tokens'}
                  error={errors.name}
                  className="font-mono"
                  onChange={(e) => {
                    setIsNameTouched(true);
                    set({ name: e.target.value.toLowerCase() });
                  }}
                />
              </div>
              <Textarea
                label="Description"
                rows={2}
                maxLength={500}
                value={values.description}
                placeholder="Describe what this is for (optional)"
                error={errors.description}
                onChange={(e) => set({ description: e.target.value })}
              />
              {kind === 'FIELD' && groups.length > 0 && (
                <Select
                  label="Inside group"
                  hint={isEdit ? 'Fixed after creation' : 'Leave empty for a top-level variable'}
                  value={values.parentId}
                  disabled={isEdit}
                  clearable={!isEdit}
                  placeholder="No group (top level)"
                  options={groups.map((g) => ({
                    value: g.id,
                    label: g.label,
                    description: g.name,
                  }))}
                  error={errors.parentId}
                  onValueChange={(parentId) => set({ parentId })}
                />
              )}
            </Section>

            {kind === 'FIELD' ? (
              <Section
                title="Data type"
                hint={isEdit ? 'Fixed after creation (stored values depend on it).' : undefined}
              >
                <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <legend className="sr-only">Data type</legend>
                  {(Object.keys(DATA_TYPES) as AttributeDataType[]).map((type) => {
                    const meta = DATA_TYPES[type];
                    const Icon = meta.icon;
                    const isOn = values.dataType === type;
                    return (
                      <label
                        key={type}
                        className={cn(
                          'flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 text-left transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-ring has-disabled:cursor-not-allowed has-disabled:opacity-40',
                          isOn
                            ? 'border-primary bg-primary-soft'
                            : 'border-border bg-surface hover:border-field hover:bg-accent',
                        )}
                      >
                        <input
                          type="radio"
                          name="dataType"
                          value={type}
                          checked={isOn}
                          disabled={isEdit && !isOn}
                          onChange={() => set({ dataType: type })}
                          className="sr-only"
                        />
                        <span
                          className={cn(
                            'flex size-7 shrink-0 items-center justify-center rounded-md [&_svg]:size-4',
                            isOn
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          <Icon aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-foreground">
                            {meta.label}
                          </span>
                          <span className="block text-[11px] leading-tight text-muted-foreground">
                            {meta.hint}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              </Section>
            ) : (
              <Section title="Group type" hint={isEdit ? 'Fixed after creation.' : undefined}>
                <fieldset className="grid gap-2 sm:grid-cols-2">
                  <legend className="sr-only">Group type</legend>
                  {(Object.keys(GROUP_TYPES) as AttributeGroupType[]).map((type) => {
                    const isOn = values.groupType === type;
                    return (
                      <label
                        key={type}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-md border p-3 text-left transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-ring has-disabled:cursor-not-allowed has-disabled:opacity-40',
                          isOn
                            ? 'border-primary bg-primary-soft'
                            : 'border-border bg-surface hover:border-field hover:bg-accent',
                        )}
                      >
                        <input
                          type="radio"
                          name="groupType"
                          value={type}
                          checked={isOn}
                          disabled={isEdit && !isOn}
                          onChange={() => set({ groupType: type })}
                          className="sr-only"
                        />
                        <GROUP_ICON
                          className={cn(
                            'mt-0.5 size-4 shrink-0',
                            isOn ? 'text-primary' : 'text-muted-foreground',
                          )}
                          aria-hidden="true"
                        />
                        <span>
                          <span className="block text-sm font-medium text-foreground">
                            {GROUP_TYPES[type].label}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {GROUP_TYPES[type].hint}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              </Section>
            )}

            {(hasLength || hasRange || hasOptions) && (
              <Section title="Validation" hint="Checked whenever a value is saved.">
                <fieldset disabled={structureLocked} className="space-y-4">
                  {hasLength && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        label="Minimum length"
                        type="number"
                        min={0}
                        value={values.minLength}
                        placeholder="No minimum"
                        error={errors.minLength}
                        onChange={(e) => set({ minLength: e.target.value })}
                      />
                      <Input
                        label="Maximum length"
                        type="number"
                        min={1}
                        value={values.maxLength}
                        placeholder={dataType === 'TEXTAREA' ? 'Default 2000' : 'Default 255'}
                        error={errors.maxLength}
                        onChange={(e) => set({ maxLength: e.target.value })}
                      />
                    </div>
                  )}
                  {hasRange && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        label="Lowest value"
                        type="number"
                        value={values.min}
                        placeholder="No limit"
                        error={errors.min}
                        onChange={(e) => set({ min: e.target.value })}
                      />
                      <Input
                        label="Highest value"
                        type="number"
                        value={values.max}
                        placeholder="No limit"
                        error={errors.max}
                        onChange={(e) => set({ max: e.target.value })}
                      />
                    </div>
                  )}
                  {hasOptions && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        Options <span className="text-danger">*</span>
                      </p>
                      {values.options.length > 0 && (
                        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 text-xs text-muted-foreground">
                          <span>Label</span>
                          <span>Stored value</span>
                          <span className="w-8" />
                        </div>
                      )}
                      {values.options.map((option, index) => (
                        <div
                          key={option.key}
                          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2"
                        >
                          <Input
                            size="sm"
                            aria-label={`Option ${index + 1} label`}
                            value={option.label}
                            placeholder="Enter a label"
                            onChange={(e) => setOption(option.key, { label: e.target.value })}
                          />
                          <Input
                            size="sm"
                            aria-label={`Option ${index + 1} value`}
                            value={option.value}
                            placeholder="Enter a value"
                            className="font-mono"
                            onChange={(e) =>
                              setOption(option.key, { value: e.target.value, isValueTouched: true })
                            }
                          />
                          <button
                            type="button"
                            aria-label={`Remove option ${index + 1}`}
                            onClick={() =>
                              set({ options: values.options.filter((o) => o.key !== option.key) })
                            }
                            className="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-danger focus-visible:outline-2 focus-visible:outline-ring"
                          >
                            <X className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        leftIcon={<Plus />}
                        onClick={() =>
                          set({
                            options: [
                              ...values.options,
                              {
                                key: (optionKey += 1),
                                label: '',
                                value: '',
                                isValueTouched: false,
                              },
                            ],
                          })
                        }
                      >
                        Add option
                      </Button>
                      {errors.options && (
                        <p role="alert" className="text-xs font-medium text-danger">
                          {errors.options}
                        </p>
                      )}
                    </div>
                  )}
                </fieldset>
              </Section>
            )}

            <Section
              title="Availability"
              hint="Scopes decide which apps receive it (OpenID Connect); locales which languages show it."
            >
              <ChipPicker
                label="Scopes"
                options={scopeOptions}
                selected={values.scopes}
                error={errors.scopes}
                onChange={(scopes) => set({ scopes })}
                addon={
                  <span className="inline-flex items-center gap-1">
                    <Input
                      size="sm"
                      aria-label="Custom scope"
                      value={scopeDraft}
                      placeholder="Add a scope, e.g. hr:read"
                      className="w-44 font-mono"
                      onChange={(e) => setScopeDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addScope();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Add scope"
                      disabled={!SCOPE_PATTERN.test(scopeDraft.trim().toLowerCase())}
                      onClick={addScope}
                    >
                      <Plus aria-hidden="true" />
                    </Button>
                  </span>
                }
              />
              <ChipPicker
                label="Locales"
                options={schemaOptions.locales}
                selected={values.locales}
                error={errors.locales}
                onChange={(locales) => set({ locales })}
              />
            </Section>

            <Section title="Behaviour">
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <Switch
                  label="Enabled"
                  hint="Shown in profile forms"
                  checked={values.isEnabled}
                  disabled={structureLocked}
                  onCheckedChange={(isEnabled) => set({ isEnabled })}
                />
                <Switch
                  label="Required"
                  hint="Users must fill it in"
                  checked={values.isRequired}
                  disabled={structureLocked}
                  onCheckedChange={(isRequired) => set({ isRequired })}
                />
                {kind === 'FIELD' && (
                  <Switch
                    label="Unique"
                    hint="No two users may share a value"
                    checked={values.isUnique || values.isUsername}
                    disabled={structureLocked || values.isUsername}
                    onCheckedChange={(isUnique) => set({ isUnique })}
                  />
                )}
                {canBeUsername && (
                  <Switch
                    label="Use to sign in"
                    hint="Works as a username (always unique)"
                    checked={values.isUsername}
                    disabled={structureLocked}
                    onCheckedChange={(isUsername) => set({ isUsername })}
                  />
                )}
                <Switch
                  label="Internal"
                  hint="Admins only; hidden from the user"
                  checked={values.isInternal}
                  disabled={structureLocked}
                  onCheckedChange={(isInternal) => set({ isInternal })}
                />
                <Switch
                  label="Include in token"
                  hint="Added to the access token claims"
                  checked={values.includeInToken}
                  onCheckedChange={(includeInToken) => set({ includeInToken })}
                />
                {kind === 'FIELD' && (
                  <Switch
                    label="Search filter"
                    hint="Admins can filter users by it"
                    checked={values.includeInSearchFilter}
                    onCheckedChange={(includeInSearchFilter) => set({ includeInSearchFilter })}
                  />
                )}
              </div>
              <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                <Select
                  label="Who can change it"
                  value={values.mutability}
                  disabled={structureLocked}
                  options={[
                    { value: 'READ_WRITE', label: 'User and admins', description: 'Read & write' },
                    { value: 'READ_ONLY', label: 'Admins only', description: 'Users can see it' },
                    {
                      value: 'IMMUTABLE',
                      label: 'Set once',
                      description: 'Never changed afterwards',
                    },
                    { value: 'WRITE_ONLY', label: 'Write only', description: 'Never returned' },
                  ]}
                  onValueChange={(mutability) =>
                    mutability && set({ mutability: mutability as AttributeMutability })
                  }
                />
                <Select
                  label="Returned in responses"
                  value={values.returned}
                  disabled={structureLocked}
                  options={[
                    { value: 'DEFAULT', label: 'By default' },
                    { value: 'ALWAYS', label: 'Always' },
                    {
                      value: 'REQUEST',
                      label: 'Only when requested',
                      description: '?include=name',
                    },
                    { value: 'NEVER', label: 'Never' },
                  ]}
                  onValueChange={(returned) =>
                    returned && set({ returned: returned as AttributeReturned })
                  }
                />
              </div>
            </Section>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {isEdit ? 'Save changes' : `Create ${noun}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

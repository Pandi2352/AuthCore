import { Check, Plus, Trash2 } from 'lucide-react';

import { Badge, Button, FieldMessage, Input, Select, Switch, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';

import {
  emptyGroupEntry,
  lowerFirst,
  type AttributeValues,
  type FieldValue,
  type GroupValue,
} from './attribute-values';
import type { FormAttribute } from './attribute.types';

const INPUT_TYPE: Partial<Record<NonNullable<FormAttribute['dataType']>, string>> = {
  EMAIL: 'email',
  MOBILE: 'tel',
  URL: 'url',
  NUMBER: 'number',
  DATE: 'date',
  DATETIME: 'datetime-local',
};

const PLACEHOLDER: Partial<Record<NonNullable<FormAttribute['dataType']>, string>> = {
  EMAIL: 'Enter an email address',
  MOBILE: 'Enter a number with country code, e.g. +91…',
  URL: 'Enter a web address (https://…)',
  NUMBER: 'Enter a number',
};

/** The variable's description, without the seeded "OpenID Connect standard claim …" text. */
function helpText(attribute: FormAttribute): string | undefined {
  const text = attribute.description.trim();
  return text && !text.startsWith('OpenID Connect standard claim') ? text : undefined;
}

function Label({ attribute }: { attribute: FormAttribute }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {attribute.label}
      {attribute.isInternal && (
        <Badge size="sm" tone="neutral">
          Admins only
        </Badge>
      )}
    </span>
  );
}

/** One variable as the right control for its data type. */
function AttributeField({
  attribute,
  value,
  error,
  onChange,
}: {
  attribute: FormAttribute;
  value: FieldValue | undefined;
  error?: string;
  onChange: (value: FieldValue) => void;
}) {
  const hint = helpText(attribute);
  const type = attribute.dataType ?? 'TEXT';

  if (type === 'BOOLEAN') {
    return (
      <div className="flex min-h-full items-center sm:pt-6">
        <Switch
          label={<Label attribute={attribute} />}
          hint={hint}
          checked={value === true}
          error={error}
          onCheckedChange={onChange}
        />
      </div>
    );
  }

  if (type === 'DROPDOWN') {
    return (
      <Select
        label={<Label attribute={attribute} />}
        hint={hint}
        required={attribute.isRequired}
        value={typeof value === 'string' && value ? value : null}
        clearable={!attribute.isRequired}
        placeholder={`Choose ${lowerFirst(attribute.label)}`}
        options={attribute.options}
        error={error}
        onValueChange={(next) => onChange(next ?? '')}
      />
    );
  }

  if (type === 'MULTI_SELECT') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset className="space-y-1.5 sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium text-foreground">
          <Label attribute={attribute} />
          {attribute.isRequired && <span className="ml-0.5 text-danger">*</span>}
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {attribute.options.map((option) => {
            const isOn = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isOn}
                onClick={() =>
                  onChange(
                    isOn ? selected.filter((v) => v !== option.value) : [...selected, option.value],
                  )
                }
                className={cn(
                  'inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                  isOn
                    ? 'border-primary bg-primary-soft text-primary-soft-foreground'
                    : 'border-field bg-surface text-muted-foreground hover:text-foreground',
                )}
              >
                {isOn && <Check className="size-3.5" aria-hidden="true" />}
                {option.label}
              </button>
            );
          })}
        </div>
        {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
        {error && <FieldMessage>{error}</FieldMessage>}
      </fieldset>
    );
  }

  if (type === 'TEXTAREA') {
    return (
      <Textarea
        label={<Label attribute={attribute} />}
        hint={hint}
        required={attribute.isRequired}
        rows={3}
        maxLength={attribute.maxLength ?? undefined}
        value={typeof value === 'string' ? value : ''}
        placeholder={`Enter ${lowerFirst(attribute.label)}`}
        error={error}
        className="sm:col-span-2"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <Input
      label={<Label attribute={attribute} />}
      hint={hint}
      required={attribute.isRequired}
      type={attribute.mutability === 'WRITE_ONLY' ? 'password' : (INPUT_TYPE[type] ?? 'text')}
      min={attribute.min ?? undefined}
      max={attribute.max ?? undefined}
      maxLength={attribute.maxLength ?? undefined}
      autoComplete="off"
      value={typeof value === 'string' ? value : ''}
      placeholder={PLACEHOLDER[type] ?? `Enter ${lowerFirst(attribute.label)}`}
      error={error}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function GroupFields({
  group,
  entry,
  errorPrefix,
  errors,
  onChange,
}: {
  group: FormAttribute;
  entry: GroupValue;
  errorPrefix: string;
  errors: Record<string, string>;
  onChange: (entry: GroupValue) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {(group.children ?? []).map((child) => (
        <AttributeField
          key={child.id}
          attribute={child}
          value={entry[child.name]}
          error={errors[`${errorPrefix}.${child.name}`]}
          onChange={(value) => onChange({ ...entry, [child.name]: value })}
        />
      ))}
    </div>
  );
}

/** Every custom variable of the user schema, as form fields (groups as sub-sections). */
export function AttributeFields({
  attributes,
  values,
  errors,
  onChange,
}: {
  attributes: FormAttribute[];
  values: AttributeValues;
  errors: Record<string, string>;
  onChange: (values: AttributeValues) => void;
}) {
  const set = (name: string, value: AttributeValues[string]) =>
    onChange({ ...values, [name]: value });
  const fields = attributes.filter((a) => a.kind === 'FIELD');
  const groups = attributes.filter((a) => a.kind === 'GROUP' && (a.children?.length ?? 0) > 0);

  return (
    <div className="space-y-5">
      {fields.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((attribute) => (
            <AttributeField
              key={attribute.id}
              attribute={attribute}
              value={values[attribute.name] as FieldValue | undefined}
              error={errors[`attributes.${attribute.name}`]}
              onChange={(value) => set(attribute.name, value)}
            />
          ))}
        </div>
      )}
      {groups.map((group) => {
        const path = `attributes.${group.name}`;
        if (group.groupType !== 'LIST') {
          return (
            <fieldset key={group.id} className="rounded-md border border-border p-4">
              <legend className="px-1 text-sm font-semibold text-foreground">
                <Label attribute={group} />
                {group.isRequired && <span className="ml-0.5 text-danger">*</span>}
              </legend>
              {helpText(group) && (
                <p className="mb-3 text-xs text-muted-foreground">{group.description}</p>
              )}
              <GroupFields
                group={group}
                entry={(values[group.name] as GroupValue | undefined) ?? emptyGroupEntry(group)}
                errorPrefix={path}
                errors={errors}
                onChange={(entry) => set(group.name, entry)}
              />
            </fieldset>
          );
        }
        const list = (values[group.name] as GroupValue[] | undefined) ?? [];
        return (
          <fieldset key={group.id} className="space-y-3 rounded-md border border-border p-4">
            <legend className="px-1 text-sm font-semibold text-foreground">
              <Label attribute={group} />
              {group.isRequired && <span className="ml-0.5 text-danger">*</span>}
            </legend>
            {list.length === 0 && (
              <p className="text-xs text-muted-foreground">
                None added{group.isRequired ? ' — add at least one.' : '.'}
              </p>
            )}
            {list.map((entry, index) => (
              // Entries have no id; the index is the identity here (no reordering).
              // oxlint-disable-next-line react/no-array-index-key
              <div key={index} className="rounded-md bg-muted/50 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {group.label} {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    leftIcon={<Trash2 />}
                    className="text-danger hover:text-danger"
                    onClick={() =>
                      set(
                        group.name,
                        list.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
                <GroupFields
                  group={group}
                  entry={entry}
                  errorPrefix={`${path}.${index}`}
                  errors={errors}
                  onChange={(next) =>
                    set(
                      group.name,
                      list.map((e, i) => (i === index ? next : e)),
                    )
                  }
                />
              </div>
            ))}
            {errors[path] && <FieldMessage>{errors[path]}</FieldMessage>}
            {list.length < 20 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Plus />}
                onClick={() => set(group.name, [...list, emptyGroupEntry(group)])}
              >
                Add {lowerFirst(group.label)}
              </Button>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}

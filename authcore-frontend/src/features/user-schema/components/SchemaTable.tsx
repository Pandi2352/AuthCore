import {
  Asterisk,
  ChevronRight,
  EyeOff,
  Filter,
  Fingerprint,
  KeyRound,
  Lock,
  Plus,
  SquarePen,
  Trash2,
} from 'lucide-react';
import { createElement, useState, type ReactNode } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateTime } from '@/components/common/DateTime';
import { TableAction } from '@/components/data-table';
import { notifyError, notifySuccess } from '@/components/feedback';
import { Badge, Switch, Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';

import { userSchemaApi } from '../api/user-schema.api';
import type { SchemaAttribute } from '../types/user-schema.types';
import { typeIcon, typeLabel, USERNAME_ICON, type SchemaRow } from './schema-meta';

export interface SchemaTableActions {
  canManage: boolean;
  onEdit: (attribute: SchemaAttribute) => void;
  /** "+" on a group: new variable inside it. */
  onAddChild: (group: SchemaAttribute) => void;
  /** After a change: put the saved variable in the list (no reload). */
  onSaved: (attribute: SchemaAttribute) => void;
  onDeleted: (id: string) => void;
}

/** Same header / cell look as the shared data table (roles, groups, users …). */
const HEAD =
  'border-b border-border bg-muted px-3 py-2.5 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase';
const CELL = 'border-b border-border px-3 py-2.5 align-middle';

/**
 * Variables as a tree table: groups open to show their variables. Same look as the other
 * tables: S.No, grey stripes, colored action icons with one-word tooltips.
 */
export function SchemaTable({
  rows,
  forceExpanded,
  actions,
}: {
  rows: SchemaRow[];
  /** While searching / filtering every group is open. */
  forceExpanded: boolean;
  actions: SchemaTableActions;
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="scrollbar-slim overflow-x-auto overflow-y-hidden rounded-md border border-border bg-surface">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">User schema variables</caption>
        <thead>
          <tr>
            <th scope="col" className={cn(HEAD, 'hidden w-16 sm:table-cell')}>
              S.No
            </th>
            <th scope="col" className={HEAD}>
              Variable
            </th>
            <th scope="col" className={cn(HEAD, 'hidden sm:table-cell')}>
              Type
            </th>
            <th scope="col" className={cn(HEAD, 'hidden md:table-cell')}>
              Source
            </th>
            <th scope="col" className={cn(HEAD, 'hidden lg:table-cell')}>
              Scopes
            </th>
            <th scope="col" className={cn(HEAD, 'hidden md:table-cell')}>
              Rules
            </th>
            <th scope="col" className={HEAD}>
              Enabled
            </th>
            <th scope="col" className={cn(HEAD, 'hidden xl:table-cell')}>
              Updated on
            </th>
            {actions.canManage && (
              <th scope="col" className={cn(HEAD, 'text-right')}>
                Action
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.flatMap((row, index) => {
            const isGroup = row.attribute.kind === 'GROUP';
            const isOpen = forceExpanded || !collapsed.has(row.attribute.id);
            return [
              <AttributeRow
                key={row.attribute.id}
                number={`${index + 1}`}
                attribute={row.attribute}
                childCount={row.childCount}
                expander={
                  isGroup ? { isOpen, onToggle: () => toggle(row.attribute.id) } : undefined
                }
                actions={actions}
              />,
              ...(isGroup && isOpen
                ? row.children.map((child, childIndex) => (
                    <AttributeRow
                      key={child.id}
                      number={`${index + 1}.${childIndex + 1}`}
                      attribute={child}
                      childCount={0}
                      depth={1}
                      parentName={row.attribute.name}
                      actions={actions}
                    />
                  ))
                : []),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

function Flag({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip content={label}>
      <span className="flex size-6 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground [&_svg]:size-3.5">
        {children}
        <span className="sr-only">{label}</span>
      </span>
    </Tooltip>
  );
}

function AttributeRow({
  number,
  attribute,
  childCount,
  depth = 0,
  parentName,
  expander,
  actions,
}: {
  /** "3", or "3.2" inside a group. */
  number: string;
  attribute: SchemaAttribute;
  childCount: number;
  depth?: 0 | 1;
  parentName?: string;
  expander?: { isOpen: boolean; onToggle: () => void };
  actions: SchemaTableActions;
}) {
  const [isToggling, setIsToggling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isGroup = attribute.kind === 'GROUP';
  const canToggle = actions.canManage && !attribute.isSystem;

  const setEnabled = async (isEnabled: boolean) => {
    setIsToggling(true);
    try {
      const saved = await userSchemaApi.update(attribute.id, {
        isEnabled,
        version: attribute.version,
      });
      actions.onSaved(saved);
      notifySuccess(`${attribute.label} ${isEnabled ? 'enabled' : 'disabled'}`, {
        description: isEnabled
          ? 'It appears in profile forms again.'
          : 'Hidden from profile forms; stored values are kept.',
      });
    } catch (err) {
      notifyError(err, 'Could not change the variable');
    } finally {
      setIsToggling(false);
    }
  };

  const remove = async () => {
    try {
      await userSchemaApi.remove(attribute.id);
      actions.onDeleted(attribute.id);
      notifySuccess(`${attribute.label} deleted`);
    } catch (err) {
      notifyError(err, 'Could not delete the variable');
      throw err;
    }
  };

  const deleteBlocker = attribute.isSystem
    ? 'Standard OpenID Connect variables can’t be deleted'
    : isGroup && childCount > 0
      ? 'Delete the variables inside it first'
      : undefined;

  return (
    <tr
      className={cn(
        'transition-colors even:bg-muted/60 hover:bg-accent/50',
        !attribute.isEnabled && 'text-muted-foreground',
      )}
    >
      <td className={cn(CELL, 'hidden text-muted-foreground tabular-nums sm:table-cell')}>
        {number}
      </td>
      <td className={CELL}>
        <div
          className={cn(
            'flex items-center gap-2 sm:gap-3',
            depth === 1 && 'ml-2 border-l-2 border-primary/30 pl-3 sm:ml-3 sm:pl-6',
          )}
        >
          {expander ? (
            <button
              type="button"
              onClick={expander.onToggle}
              aria-expanded={expander.isOpen}
              aria-label={`${expander.isOpen ? 'Collapse' : 'Expand'} ${attribute.label}`}
              className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <ChevronRight
                className={cn(
                  'size-4 transition-transform motion-reduce:transition-none',
                  expander.isOpen && 'rotate-90',
                )}
                aria-hidden="true"
              />
            </button>
          ) : (
            depth === 0 && <span className="hidden w-6 shrink-0 sm:block" aria-hidden="true" />
          )}
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-md [&_svg]:size-4',
              isGroup
                ? 'bg-nav-violet text-primary-foreground'
                : 'bg-primary-soft text-primary-soft-foreground',
            )}
          >
            {createElement(typeIcon(attribute), { 'aria-hidden': true })}
          </span>
          {/* Label on the first line, the variable name under it (like role name / key). */}
          <span className="block min-w-0">
            <span className="block font-medium text-foreground">
              {attribute.label}
              {isGroup && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  ({childCount} {childCount === 1 ? 'variable' : 'variables'})
                </span>
              )}
            </span>
            <code className="block font-mono text-xs break-all text-primary">
              {parentName ? `${parentName}.${attribute.name}` : attribute.name}
            </code>
            <span className="block text-xs text-muted-foreground sm:hidden">
              {typeLabel(attribute)}
            </span>
          </span>
        </div>
      </td>
      <td className={cn(CELL, 'hidden whitespace-nowrap text-foreground sm:table-cell')}>
        {typeLabel(attribute)}
      </td>
      <td className={cn(CELL, 'hidden md:table-cell')}>
        {attribute.isSystem ? (
          <Badge size="sm" tone="neutral">
            System
          </Badge>
        ) : (
          <Badge size="sm" tone="primary">
            Custom
          </Badge>
        )}
      </td>
      <td className={cn(CELL, 'hidden lg:table-cell')}>
        <div className="flex flex-wrap gap-1">
          {attribute.scopes.map((scope) => (
            <Badge key={scope} size="sm" tone="info" variant="outline" className="font-mono">
              {scope}
            </Badge>
          ))}
        </div>
      </td>
      <td className={cn(CELL, 'hidden md:table-cell')}>
        <div className="flex flex-wrap gap-1">
          {attribute.isRequired && (
            <Flag label="Required">
              <Asterisk />
            </Flag>
          )}
          {attribute.isUnique && (
            <Flag label="Unique: no two users share a value">
              <Fingerprint />
            </Flag>
          )}
          {attribute.isUsername && (
            <Flag label="Can be used to sign in">
              <USERNAME_ICON />
            </Flag>
          )}
          {attribute.includeInToken && (
            <Flag label="Included in the access token">
              <KeyRound />
            </Flag>
          )}
          {attribute.includeInSearchFilter && (
            <Flag label="Admins can filter users by it">
              <Filter />
            </Flag>
          )}
          {attribute.isInternal && (
            <Flag label="Internal: admins only, hidden from the user">
              <EyeOff />
            </Flag>
          )}
          {(attribute.mutability === 'READ_ONLY' || attribute.mutability === 'IMMUTABLE') && (
            <Flag
              label={
                attribute.mutability === 'READ_ONLY'
                  ? 'Read-only for users'
                  : 'Set once, never changed'
              }
            >
              <Lock />
            </Flag>
          )}
        </div>
      </td>
      <td className={CELL}>
        {canToggle ? (
          <Switch
            size="sm"
            checked={attribute.isEnabled}
            disabled={isToggling}
            aria-label={`${attribute.label} enabled`}
            onCheckedChange={(checked) => void setEnabled(checked)}
          />
        ) : (
          <Badge size="sm" tone={attribute.isEnabled ? 'success' : 'neutral'}>
            {attribute.isEnabled ? 'On' : 'Off'}
          </Badge>
        )}
      </td>
      <td className={cn(CELL, 'hidden whitespace-nowrap xl:table-cell')}>
        <DateTime value={attribute.updatedAt} format="full" />
      </td>
      {actions.canManage && (
        <td className={CELL}>
          <span className="flex items-center justify-end gap-1.5">
            {isGroup && (
              <TableAction
                tone="success"
                icon={<Plus />}
                tooltip="Add variable"
                label={`Add a variable inside ${attribute.label}`}
                onClick={() => actions.onAddChild(attribute)}
              />
            )}
            <TableAction
              tone="primary"
              icon={<SquarePen />}
              tooltip="Edit"
              label={`${attribute.isSystem ? 'Edit labels and scopes of' : 'Edit'} ${attribute.label}`}
              onClick={() => actions.onEdit(attribute)}
            />
            <TableAction
              tone="danger"
              icon={<Trash2 />}
              tooltip="Delete"
              label={`Delete ${attribute.label}`}
              disabledReason={deleteBlocker}
              onClick={() => setConfirmDelete(true)}
            />
          </span>
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title={`Delete ${attribute.label}?`}
            description={`The variable is removed and its value is deleted from every user. Type ${attribute.name} to confirm.`}
            confirmPhrase={attribute.name}
            confirmText="Delete"
            destructive
            onConfirm={remove}
          />
        </td>
      )}
    </tr>
  );
}

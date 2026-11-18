import {
  Asterisk,
  ChevronRight,
  EyeOff,
  Filter,
  Fingerprint,
  KeyRound,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { createElement, useState, type ReactNode } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { notifyError, notifySuccess } from '@/components/feedback';
import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  Switch,
  Tooltip,
} from '@/components/ui';
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

/** Variables as a tree table: groups expand to their child variables. */
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
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm sm:min-w-[40rem]">
        <thead>
          <tr className="border-b border-border bg-muted/60 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <th scope="col" className="py-2.5 pr-2 pl-3 font-medium sm:px-4">
              Variable
            </th>
            <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">
              Type
            </th>
            <th scope="col" className="hidden px-3 py-2.5 font-medium lg:table-cell">
              Scopes
            </th>
            <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">
              Rules
            </th>
            <th scope="col" className="px-2 py-2.5 font-medium sm:px-3">
              <span className="sm:hidden">On</span>
              <span className="hidden sm:inline">Enabled</span>
            </th>
            <th scope="col" className="w-10 py-2.5 pr-2 pl-1 sm:w-12 sm:px-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isGroup = row.attribute.kind === 'GROUP';
            const isOpen = forceExpanded || !collapsed.has(row.attribute.id);
            return [
              <AttributeRow
                key={row.attribute.id}
                attribute={row.attribute}
                childCount={row.childCount}
                expander={
                  isGroup ? { isOpen, onToggle: () => toggle(row.attribute.id) } : undefined
                }
                actions={actions}
              />,
              ...(isGroup && isOpen
                ? row.children.map((child) => (
                    <AttributeRow
                      key={child.id}
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
      <span className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-3.5">
        {children}
        <span className="sr-only">{label}</span>
      </span>
    </Tooltip>
  );
}

function AttributeRow({
  attribute,
  childCount,
  depth = 0,
  parentName,
  expander,
  actions,
}: {
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
      ? 'Delete or move the variables inside it first'
      : null;

  return (
    <tr
      className={cn(
        'border-b border-border transition-colors hover:bg-accent/50',
        isGroup && 'bg-muted/30',
        !attribute.isEnabled && 'text-muted-foreground',
      )}
    >
      <td className="py-3 pr-2 pl-3 sm:px-4">
        <div
          className={cn(
            'flex items-center gap-2 sm:gap-3',
            depth === 1 && 'ml-2 border-l-2 border-border pl-3 sm:ml-3 sm:pl-6',
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
                ? 'bg-primary text-primary-foreground'
                : 'bg-primary-soft text-primary-soft-foreground',
            )}
          >
            {createElement(typeIcon(attribute), { 'aria-hidden': true })}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-foreground">{attribute.label}</span>
              {isGroup && (
                <span className="text-xs text-muted-foreground">
                  ({childCount} {childCount === 1 ? 'variable' : 'variables'})
                </span>
              )}
              {attribute.isSystem ? (
                <Badge size="sm" tone="neutral">
                  System
                </Badge>
              ) : (
                <Badge size="sm" tone="primary">
                  Custom
                </Badge>
              )}
            </div>
            <span className="block text-xs text-muted-foreground sm:hidden">
              {typeLabel(attribute)}
            </span>
            <code className="block truncate font-mono text-xs text-muted-foreground">
              {parentName ? `${parentName}.${attribute.name}` : attribute.name}
            </code>
          </div>
        </div>
      </td>
      <td className="hidden px-3 py-3 whitespace-nowrap text-foreground sm:table-cell">
        {typeLabel(attribute)}
      </td>
      <td className="hidden px-3 py-3 lg:table-cell">
        <div className="flex flex-wrap gap-1">
          {attribute.scopes.map((scope) => (
            <span
              key={scope}
              className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
            >
              {scope}
            </span>
          ))}
        </div>
      </td>
      <td className="hidden px-3 py-3 md:table-cell">
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
      <td className="px-2 py-3 sm:px-3">
        {canToggle ? (
          <Switch
            size="sm"
            checked={attribute.isEnabled}
            disabled={isToggling}
            aria-label={`${attribute.label} enabled`}
            onCheckedChange={(checked) => void setEnabled(checked)}
          />
        ) : (
          <span className="text-xs font-medium text-muted-foreground">
            {attribute.isEnabled ? 'On' : 'Off'}
          </span>
        )}
      </td>
      <td className="py-3 pr-2 pl-1 text-right sm:px-3">
        {actions.canManage && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton
                  aria-label={`Actions for ${attribute.label}`}
                  icon={<MoreHorizontal />}
                  variant="ghost"
                  size="sm"
                  showTooltip={false}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                <DropdownMenuItem icon={<Pencil />} onSelect={() => actions.onEdit(attribute)}>
                  {attribute.isSystem ? 'Edit labels & scopes' : 'Edit'}
                </DropdownMenuItem>
                {isGroup && (
                  <DropdownMenuItem icon={<Plus />} onSelect={() => actions.onAddChild(attribute)}>
                    Add a variable inside
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  icon={<Trash2 />}
                  destructive
                  disabled={deleteBlocker !== null}
                  onSelect={() => setConfirmDelete(true)}
                >
                  {deleteBlocker ? (
                    <span className="flex flex-col">
                      Delete
                      <span className="text-[11px] font-normal">{deleteBlocker}</span>
                    </span>
                  ) : (
                    'Delete'
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
          </>
        )}
      </td>
    </tr>
  );
}

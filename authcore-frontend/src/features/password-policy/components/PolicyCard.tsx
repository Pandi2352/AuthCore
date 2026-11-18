import { Copy, Pencil, Power, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateTime } from '@/components/common/DateTime';
import { notifyError, notifySuccess } from '@/components/feedback';
import { Badge, Button, IconButton, Tooltip } from '@/components/ui';
import { paths } from '@/config';
import { cn } from '@/lib/utils';

import { passwordPolicyApi } from '../api/password-policy.api';
import type { PasswordPolicy } from '../types/password-policy.types';
import { policyStrength, ruleChips } from './policy-rules';
import { StrengthGauge } from './PolicyControls';

interface PolicyCardProps {
  policy: PasswordPolicy & { id: string };
  canManage: boolean;
  /** After any change: reload the list. */
  onChanged: () => void;
}

/** One saved policy: strength, key rules, actions. */
export function PolicyCard({ policy, canManage, onChanged }: PolicyCardProps) {
  const [isDuplicating, setIsDuplicating] = useState(false);
  const strength = policyStrength(policy);
  const chips = ruleChips(policy);

  const activate = async () => {
    try {
      await passwordPolicyApi.activate(policy.id);
      notifySuccess(`${policy.policyName} is now the active policy`, {
        description: 'Every new or changed password must follow it.',
      });
      onChanged();
    } catch (err) {
      notifyError(err, 'Could not activate the policy');
      throw err;
    }
  };

  const duplicate = async () => {
    setIsDuplicating(true);
    try {
      const copy = await passwordPolicyApi.duplicate(policy.id);
      notifySuccess(`Created ${copy.policyName}`, {
        description: 'Saved inactive — edit it, then activate it.',
      });
      onChanged();
    } catch (err) {
      notifyError(err, 'Could not duplicate the policy');
    } finally {
      setIsDuplicating(false);
    }
  };

  const remove = async () => {
    try {
      await passwordPolicyApi.remove(policy.id);
      notifySuccess(`${policy.policyName} deleted`);
      onChanged();
    } catch (err) {
      notifyError(err, 'Could not delete the policy');
      throw err;
    }
  };

  return (
    <article
      aria-label={policy.policyName}
      className={cn(
        'flex flex-col gap-4 rounded-md border bg-surface p-card transition-colors',
        policy.isActive
          ? 'border-primary ring-1 ring-primary/30'
          : 'border-border hover:border-field',
      )}
    >
      <header className="flex items-start gap-3">
        <StrengthGauge strength={strength} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className="truncate text-sm font-semibold text-foreground"
              title={policy.policyName}
            >
              {policy.policyName}
            </h3>
            {policy.isActive && (
              <Badge size="sm" tone="primary" variant="solid">
                Active
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {strength.label} · updated{' '}
            {policy.updatedAt ? <DateTime value={policy.updatedAt} format="relative" /> : '—'}
          </p>
        </div>
      </header>

      <ul aria-label="Key rules" className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <li
            key={chip}
            className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          >
            {chip}
          </li>
        ))}
      </ul>

      <footer className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {canManage && !policy.isActive && (
          <ConfirmDialog
            trigger={
              <Button size="sm" leftIcon={<Power />}>
                Make active
              </Button>
            }
            title={`Make ${policy.policyName} the active policy?`}
            description="New passwords (sign-up, reset, change) must follow it from now on. Existing passwords keep working; the current active policy is kept, inactive."
            confirmText="Make active"
            onConfirm={activate}
          />
        )}
        <Button variant={policy.isActive ? 'outline' : 'ghost'} size="sm" asChild>
          <Link to={paths.admin.passwordPolicyEdit(policy.id)}>
            <Pencil aria-hidden="true" />
            {canManage ? 'Edit' : 'View'}
          </Link>
        </Button>
        {canManage && (
          <IconButton
            variant="ghost"
            size="sm"
            className="ml-auto"
            icon={<Copy />}
            aria-label={`Duplicate ${policy.policyName}`}
            isLoading={isDuplicating}
            onClick={() => void duplicate()}
          />
        )}
        {canManage &&
          (policy.isActive ? (
            <Tooltip content="The active policy can't be deleted — activate another one first">
              <span>
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 />}
                  disabled
                  showTooltip={false}
                  aria-label={`Delete ${policy.policyName} (activate another policy first)`}
                />
              </span>
            </Tooltip>
          ) : (
            <ConfirmDialog
              trigger={
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 />}
                  aria-label={`Delete ${policy.policyName}`}
                  className="text-danger hover:text-danger"
                />
              }
              title={`Delete ${policy.policyName}?`}
              description="The policy is removed. It isn't in use, so no password is affected."
              confirmText="Delete"
              destructive
              onConfirm={remove}
            />
          ))}
      </footer>
    </article>
  );
}

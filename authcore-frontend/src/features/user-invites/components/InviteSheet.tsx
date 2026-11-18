import { CheckCircle2, CircleAlert, MailPlus, User, Users } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { notifyError, notifySuccess } from '@/components/feedback';
import {
  Alert,
  Button,
  Checkbox,
  Input,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  Textarea,
} from '@/components/ui';
import { getFieldErrors, isAbortError } from '@/lib/api';
import { cn } from '@/lib/utils';

import { invitesApi } from '../api/invites.api';
import {
  INVITE_MESSAGE_MAX,
  MAX_BULK_INVITES,
  type BulkInviteResult,
  type GroupOption,
  type InvitePerson,
} from '../types/invite.types';
import { SKIP_REASON } from './invite-labels';
import { EMAIL, parsePeople } from './parse-people';

function GroupPicker({
  groups,
  selected,
  onChange,
}: {
  groups: GroupOption[] | null;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [filter, setFilter] = useState('');
  if (groups === null) return null;
  if (groups.length === 0) {
    return <p className="text-xs text-muted-foreground">No groups yet.</p>;
  }
  const shown = groups.filter((g) => g.label.toLowerCase().includes(filter.trim().toLowerCase()));
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium text-foreground">
        Add to groups <span className="font-normal text-muted-foreground">(optional)</span>
      </legend>
      {groups.length > 8 && (
        <Input
          size="sm"
          value={filter}
          placeholder="Filter groups"
          aria-label="Filter groups"
          onChange={(e) => setFilter(e.target.value)}
        />
      )}
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
        {shown.map((group) => (
          <Checkbox
            key={group.id}
            label={group.label}
            checked={selected.includes(group.id)}
            onCheckedChange={(checked) =>
              onChange(checked ? [...selected, group.id] : selected.filter((id) => id !== group.id))
            }
          />
        ))}
        {shown.length === 0 && <p className="text-xs text-muted-foreground">No group matches.</p>}
      </div>
      <p className="text-xs text-muted-foreground">
        They join these groups when they accept. You can only grant access you have yourself.
      </p>
    </fieldset>
  );
}

type Mode = 'one' | 'many';

export function InviteSheet({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After invites were sent: refresh lists / counts. */
  onInvited: () => void;
}) {
  const [mode, setMode] = useState<Mode>('one');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [message, setMessage] = useState('');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<GroupOption[] | null>(null);
  const [hasTried, setHasTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<BulkInviteResult | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        setGroups(await invitesApi.groups(controller.signal));
      } catch (error) {
        // No GROUP_READ: invite without groups.
        if (!isAbortError(error)) setGroups(null);
      }
    };
    void load();
    return () => controller.abort();
  }, [open]);

  const parsed = useMemo(() => parsePeople(bulkText), [bulkText]);
  const valid = parsed.filter((p) => p.person !== null);
  const invalid = parsed.filter((p) => p.problem !== null);

  const emailError =
    serverErrors.email ??
    (hasTried && !EMAIL.test(email.trim()) ? 'Enter a valid email address' : undefined);
  const bulkError = hasTried
    ? valid.length === 0
      ? 'Add at least one valid email'
      : valid.length > MAX_BULK_INVITES
        ? `At most ${MAX_BULK_INVITES} people at a time`
        : undefined
    : undefined;

  const options = {
    groupIds: groupIds.length > 0 ? groupIds : undefined,
    message: message.trim() || undefined,
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    setHasTried(true);
    setServerErrors({});
    if (
      mode === 'one'
        ? !EMAIL.test(email.trim())
        : valid.length === 0 || valid.length > MAX_BULK_INVITES
    )
      return;
    setIsSending(true);
    try {
      if (mode === 'one') {
        const invite = await invitesApi.create({
          email: email.trim().toLowerCase(),
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          ...options,
        });
        notifySuccess(`Invite sent to ${invite.email}`, {
          description: 'They get an email with a link to set their password.',
        });
        onInvited();
        onOpenChange(false);
      } else {
        const outcome = await invitesApi.bulk(
          valid.map((p) => p.person as InvitePerson),
          options,
        );
        setResult(outcome);
        onInvited();
        if (outcome.skipped.length === 0) {
          notifySuccess(`${outcome.createdCount} invites sent`);
          onOpenChange(false);
        } else {
          notifySuccess(`${outcome.createdCount} sent, ${outcome.skipped.length} skipped`, {
            description: 'See the list for the reasons.',
          });
        }
      }
    } catch (err) {
      setServerErrors(getFieldErrors(err));
      notifyError(err, 'Could not send the invite');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title="Invite people"
        description="They get an email with a link to create their account. Until they accept, the invite is pending."
        size="lg"
      >
        <form noValidate onSubmit={(e) => void send(e)} className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="space-y-5">
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="sr-only">How many people</legend>
              {(
                [
                  { value: 'one', label: 'One person', icon: User },
                  { value: 'many', label: 'Several people', icon: Users },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-ring',
                    mode === value
                      ? 'border-primary bg-primary-soft text-primary-soft-foreground'
                      : 'border-border text-muted-foreground hover:border-field hover:text-foreground',
                  )}
                >
                  <input
                    type="radio"
                    name="invite-mode"
                    value={value}
                    checked={mode === value}
                    onChange={() => {
                      setMode(value);
                      setHasTried(false);
                      setResult(null);
                    }}
                    className="sr-only"
                  />
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </label>
              ))}
            </fieldset>

            {mode === 'one' ? (
              <div className="space-y-4">
                <Input
                  label="Email address"
                  type="email"
                  required
                  autoComplete="off"
                  value={email}
                  placeholder="Enter their work email"
                  error={emailError}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="First name"
                    maxLength={50}
                    value={firstName}
                    placeholder="Enter a first name (optional)"
                    error={serverErrors.firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                  <Input
                    label="Last name"
                    maxLength={50}
                    value={lastName}
                    placeholder="Enter a last name (optional)"
                    error={serverErrors.lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Textarea
                  label="People"
                  required
                  rows={6}
                  value={bulkText}
                  placeholder={
                    'One per line, e.g.\nemail\nemail, First name, Last name\nFirst Last <email>'
                  }
                  hint={`Up to ${MAX_BULK_INVITES} people. Paste from a spreadsheet or an email.`}
                  error={bulkError}
                  className="min-h-36 font-mono text-xs"
                  onChange={(e) => {
                    setBulkText(e.target.value);
                    setResult(null);
                  }}
                />
                {parsed.length > 0 && !result && (
                  <div className="rounded-md border border-border">
                    <p className="flex items-center gap-3 border-b border-border px-3 py-2 text-xs">
                      <span className="font-medium text-success">{valid.length} ready</span>
                      {invalid.length > 0 && (
                        <span className="font-medium text-danger">{invalid.length} to fix</span>
                      )}
                    </p>
                    <ul className="max-h-48 divide-y divide-border overflow-y-auto">
                      {parsed.map((p) => (
                        <li
                          key={`${p.line}-${p.raw}`}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs"
                        >
                          {p.person ? (
                            <CheckCircle2
                              className="size-3.5 shrink-0 text-success"
                              aria-hidden="true"
                            />
                          ) : (
                            <CircleAlert
                              className="size-3.5 shrink-0 text-danger"
                              aria-hidden="true"
                            />
                          )}
                          <span className="min-w-0 flex-1 truncate font-mono text-foreground">
                            {p.person?.email ?? p.raw}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {p.problem ??
                              ([p.person?.firstName, p.person?.lastName]
                                .filter(Boolean)
                                .join(' ') ||
                                '—')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result && (
                  <Alert
                    variant={result.skipped.length > 0 ? 'warning' : 'success'}
                    title={`${result.createdCount} sent · ${result.skipped.length} skipped`}
                    message={
                      <ul className="mt-1 space-y-0.5">
                        {result.skipped.map((s) => (
                          <li key={s.email}>
                            <span className="font-mono">{s.email}</span> — {SKIP_REASON[s.reason]}
                          </li>
                        ))}
                      </ul>
                    }
                  />
                )}
              </div>
            )}

            <GroupPicker groups={groups} selected={groupIds} onChange={setGroupIds} />

            <Textarea
              label="Personal message"
              rows={3}
              maxLength={INVITE_MESSAGE_MAX}
              value={message}
              placeholder="Add a note to the email (optional)"
              hint={`${message.length}/${INVITE_MESSAGE_MAX}`}
              error={serverErrors.message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {result ? 'Close' : 'Cancel'}
            </Button>
            <Button type="submit" leftIcon={<MailPlus />} isLoading={isSending}>
              {mode === 'one'
                ? 'Send invite'
                : valid.length > 0
                  ? `Send ${valid.length} invite${valid.length === 1 ? '' : 's'}`
                  : 'Send invites'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

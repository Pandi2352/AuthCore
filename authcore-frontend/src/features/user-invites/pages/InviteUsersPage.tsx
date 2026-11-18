import { Clock, MailCheck, MailPlus, RefreshCw, UserCheck } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

import { SearchInput } from '@/components/common/SearchInput';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import { Button, Pagination, Select, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { usePermissions } from '@/features/auth';
import { isAbortError, type Paginated } from '@/lib/api';

import { invitesApi } from '../api/invites.api';
import { InviteSheet } from '../components/InviteSheet';
import { AcceptedInvitesTable, OpenInvitesTable } from '../components/InvitesTable';
import { RegisteredTable } from '../components/RegisteredTable';
import type { Invite, InviteStatus, RegisteredUser } from '../types/invite.types';

type Tab = 'pending' | 'accepted' | 'registered';
type OpenStatus = Extract<InviteStatus, 'PENDING' | 'EXPIRED' | 'REVOKED'>;

const TABS: Array<{ value: Tab; label: string; icon: typeof Clock }> = [
  { value: 'pending', label: 'Pending users', icon: Clock },
  { value: 'accepted', label: 'Accepted users', icon: MailCheck },
  { value: 'registered', label: 'Registered users', icon: UserCheck },
];
const PAGE_SIZE = 10;
const isTab = (value: string | null): value is Tab =>
  value === 'pending' || value === 'accepted' || value === 'registered';

const settledValue = (result: PromiseSettledResult<number>): number | null =>
  result.status === 'fulfilled' ? result.value : null;

type Loaded =
  | { key: string; kind: 'invites'; page: Paginated<Invite> }
  | { key: string; kind: 'users'; page: Paginated<RegisteredUser> };

/** Users → Invite users: send invites, follow them up, see who joined. */
export function InviteUsersPage() {
  const { hasPermission } = usePermissions();
  const canInvite = hasPermission('USER_INVITE');
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: Tab = isTab(tabParam) ? tabParam : 'pending';
  const [openStatus, setOpenStatus] = useState<OpenStatus>('PENDING');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [nonce, setNonce] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<{ key: string; error: unknown } | null>(null);
  const [counts, setCounts] = useState<{ key: number; values: Record<Tab, number | null> }>({
    key: -1,
    values: { pending: null, accepted: null, registered: null },
  });
  const [sheet, setSheet] = useState({ open: false, key: 0 });

  const requestKey = `${tab}|${openStatus}|${search}|${page}|${nonce}`;

  useEffect(() => {
    const controller = new AbortController();
    const [currentTab, status, query, pageText] = requestKey.split('|');
    const pageNumber = Number(pageText);
    const load = async () => {
      try {
        if (currentTab === 'registered') {
          const result = await invitesApi.registered(
            { page: pageNumber, limit: PAGE_SIZE, search: query },
            controller.signal,
          );
          setLoaded({ key: requestKey, kind: 'users', page: result });
        } else {
          const result = await invitesApi.list(
            {
              page: pageNumber,
              limit: PAGE_SIZE,
              search: query,
              status: currentTab === 'accepted' ? 'ACCEPTED' : (status as OpenStatus),
            },
            controller.signal,
          );
          setLoaded({ key: requestKey, kind: 'invites', page: result });
        }
      } catch (error) {
        if (!isAbortError(error)) setFailure({ key: requestKey, error });
      }
    };
    void load();
    return () => controller.abort();
  }, [requestKey]);

  // Tab badges (refresh after every change).
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    const load = async () => {
      const [pending, accepted, registered] = await Promise.allSettled([
        invitesApi.count('PENDING', signal),
        invitesApi.count('ACCEPTED', signal),
        invitesApi.registeredCount(signal),
      ]);
      if (signal.aborted) return;
      setCounts({
        key: nonce,
        values: {
          pending: settledValue(pending),
          accepted: settledValue(accepted),
          registered: settledValue(registered),
        },
      });
    };
    void load();
    return () => controller.abort();
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const changeTab = (next: string) => {
    if (!isTab(next)) return;
    setParams(next === 'pending' ? {} : { tab: next }, { replace: true });
    setPage(1);
    setSearch('');
  };

  const current = loaded?.key === requestKey ? loaded : null;
  // Keep the last page of the same tab while the next one loads (no flicker).
  const showing = current ?? (loaded?.key.startsWith(`${tab}|`) ? loaded : null);
  const isFirstLoad = !showing && failure?.key !== requestKey;
  const total = showing?.page.meta.totalItems ?? 0;
  const isSearching = search.trim() !== '';

  const empty: Record<Tab, { title: string; text: string; icon: ReactNode }> = {
    pending: {
      icon: <Clock />,
      title:
        openStatus === 'PENDING'
          ? 'No pending invites'
          : openStatus === 'EXPIRED'
            ? 'No expired invites'
            : 'No revoked invites',
      text:
        openStatus === 'PENDING'
          ? 'Invite people by email; they show up here until they accept.'
          : 'Nothing here right now.',
    },
    accepted: {
      icon: <MailCheck />,
      title: 'No accepted invites yet',
      text: 'People appear here once they open their link and create their account.',
    },
    registered: {
      icon: <UserCheck />,
      title: 'No self-registered users',
      text: 'People who sign up on the sign-up page appear here.',
    },
  };

  return (
    <PageContainer>
      <PageHeader
        title="Invite users"
        description="Invite people by email, follow up on pending invites and see who has joined."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 whitespace-nowrap"
              leftIcon={<RefreshCw />}
              onClick={reload}
            >
              Refresh
            </Button>
            {canInvite && (
              <Button
                size="sm"
                className="shrink-0 whitespace-nowrap"
                leftIcon={<MailPlus />}
                onClick={() => setSheet((s) => ({ open: true, key: s.key + 1 }))}
              >
                Invite people
              </Button>
            )}
          </div>
        }
      />

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList className="mb-4 [scrollbar-width:none] overflow-x-auto overflow-y-hidden">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="gap-2 whitespace-nowrap">
              <Icon className="size-4" aria-hidden="true" />
              {label}
              {counts.values[value] !== null && (
                <span className="rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground tabular-nums">
                  {counts.values[value]}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <section
        aria-label={TABS.find((t) => t.value === tab)?.label}
        className="overflow-hidden rounded-md border border-border bg-surface"
      >
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <SearchInput
            size="sm"
            key={tab}
            value={search}
            onSearch={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder={
              tab === 'registered' ? 'Search by name, email or username' : 'Search by name or email'
            }
            aria-label="Search"
            className="sm:max-w-sm sm:flex-1"
          />
          {tab === 'pending' && (
            <Select
              aria-label="Invite status"
              size="sm"
              value={openStatus}
              className="sm:w-44"
              options={[
                { value: 'PENDING', label: 'Waiting to accept' },
                { value: 'EXPIRED', label: 'Expired' },
                { value: 'REVOKED', label: 'Revoked' },
              ]}
              onValueChange={(value) => {
                if (value) {
                  setOpenStatus(value as OpenStatus);
                  setPage(1);
                }
              }}
            />
          )}
          <p className="text-xs text-muted-foreground sm:ml-auto" aria-live="polite">
            {showing ? `${total} ${total === 1 ? 'result' : 'results'}` : ''}
          </p>
        </div>

        {isFirstLoad && <LoadingState variant="table" label="Loading" />}
        {!showing && failure?.key === requestKey && (
          <ErrorState error={failure.error} title="Could not load the list" onRetry={reload} />
        )}
        {showing &&
          (showing.page.items.length === 0 ? (
            <EmptyState
              size="compact"
              className="py-12"
              icon={empty[tab].icon}
              title={isSearching ? 'Nothing matches your search' : empty[tab].title}
              description={isSearching ? 'Try another name or email.' : empty[tab].text}
              action={
                !isSearching && tab === 'pending' && openStatus === 'PENDING' && canInvite ? (
                  <Button
                    size="sm"
                    leftIcon={<MailPlus />}
                    onClick={() => setSheet((s) => ({ open: true, key: s.key + 1 }))}
                  >
                    Invite people
                  </Button>
                ) : undefined
              }
            />
          ) : showing.kind === 'users' ? (
            <RegisteredTable users={showing.page.items} />
          ) : tab === 'accepted' ? (
            <AcceptedInvitesTable invites={showing.page.items} />
          ) : (
            <OpenInvitesTable
              invites={showing.page.items}
              canManage={canInvite}
              onChanged={reload}
            />
          ))}

        {showing && total > PAGE_SIZE && (
          <div className="border-t border-border p-3">
            <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        )}
      </section>

      <InviteSheet
        key={sheet.key}
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        onInvited={reload}
      />
    </PageContainer>
  );
}

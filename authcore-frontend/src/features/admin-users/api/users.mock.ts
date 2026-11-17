import type { BulkTarget, TablePage, TableQuery } from '@/components/data-table';

import type { AdminUser, AdminUserRole, AdminUserStatus } from '../types/admin-user.types';

/**
 * MOCK server for the users list until GET /admin/users is wired (Level 2, module 21).
 * Behaves like the real API: server-side search, filters, multi-sort, paging, latency,
 * cancellation. Test switches (development): `?mock=error` fails every request,
 * `?mock=empty` returns a first-run (no users) result.
 */

// Deterministic data: the same 243 users on every load.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const FIRST = [
  'Aarav',
  'Priya',
  'Arjun',
  'Meera',
  'Ravi',
  'Kavya',
  'Ananya',
  'Vikram',
  'Divya',
  'Rahul',
  'Sneha',
  'Karthik',
  'Lakshmi',
  'Nikhil',
  'Pooja',
  'Suresh',
  'Deepa',
  'Harish',
  'Isha',
  'Manoj',
  'Olivia',
  'Liam',
  'Emma',
  'Noah',
  'Sophia',
  'Lucas',
  'Mia',
  'Ethan',
  'Chloe',
  'Daniel',
];
const LAST = [
  'Raman',
  'Kumar',
  'Nair',
  'Iyer',
  'Sharma',
  'Reddy',
  'Pillai',
  'Menon',
  'Rao',
  'Das',
  'Patel',
  'Singh',
  'Joshi',
  'Gupta',
  'Bose',
  'Smith',
  'Johnson',
  'Brown',
  'Garcia',
  'Miller',
  'Wilson',
  'Taylor',
];
const ROLES: AdminUserRole[] = [
  'member',
  'member',
  'member',
  'viewer',
  'viewer',
  'manager',
  'admin',
];
const STATUSES: AdminUserStatus[] = [
  'active',
  'active',
  'active',
  'active',
  'invited',
  'suspended',
  'pending',
];
const DAY = 86_400_000;
const NOW = Date.parse('2026-11-17T09:00:00Z');

function generate(count: number): AdminUser[] {
  const rand = seeded(42);
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)] as T;
  return Array.from({ length: count }, (_, i) => {
    const firstName = pick(FIRST);
    const lastName = pick(LAST);
    const status = pick(STATUSES);
    const createdAt = NOW - Math.floor(rand() * 720) * DAY - Math.floor(rand() * DAY);
    const neverSignedIn = status === 'invited' || status === 'pending';
    return {
      id: `usr_${String(i + 1).padStart(4, '0')}`,
      firstName,
      lastName,
      email: `${firstName}.${lastName}${i + 1}@example.com`.toLowerCase(),
      role: pick(ROLES),
      status,
      sessions: neverSignedIn || status === 'suspended' ? 0 : Math.floor(rand() * 5),
      signIns: neverSignedIn ? 0 : Math.floor(rand() * 900) + 1,
      lastActiveAt: neverSignedIn
        ? null
        : new Date(Math.min(NOW, createdAt + Math.floor(rand() * (NOW - createdAt)))).toISOString(),
      createdAt: new Date(createdAt).toISOString(),
    };
  });
}

let users = generate(243);

const mockMode = () =>
  typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('mock');

const fullName = (u: AdminUser) => `${u.firstName} ${u.lastName}`;
const SORT_VALUE: Record<string, (u: AdminUser) => string | number> = {
  name: (u) => fullName(u).toLowerCase(),
  email: (u) => u.email,
  role: (u) => ['admin', 'manager', 'member', 'viewer'].indexOf(u.role),
  status: (u) => u.status,
  sessions: (u) => u.sessions,
  signIns: (u) => u.signIns,
  lastActiveAt: (u) => (u.lastActiveAt ? Date.parse(u.lastActiveAt) : 0),
  createdAt: (u) => Date.parse(u.createdAt),
};

function matching(query: Pick<TableQuery, 'search' | 'filters'>): AdminUser[] {
  const q = query.search.trim().toLowerCase();
  const statuses = query.filters.status ?? [];
  const roles = query.filters.role ?? [];
  return users.filter(
    (u) =>
      (!q || fullName(u).toLowerCase().includes(q) || u.email.includes(q)) &&
      (statuses.length === 0 || statuses.includes(u.status)) &&
      (roles.length === 0 || roles.includes(u.role)),
  );
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

export async function mockFetchUsers(
  query: TableQuery,
  signal: AbortSignal,
): Promise<TablePage<AdminUser>> {
  await wait(350 + Math.floor(Math.random() * 350), signal);
  if (mockMode() === 'error') throw new Error('Mock server error (remove ?mock=error to recover)');
  if (mockMode() === 'empty' && !query.search && Object.keys(query.filters).length === 0) {
    return { items: [], total: 0 };
  }
  const rows = matching(query);
  const sorted = rows.toSorted((a, b) => {
    for (const rule of query.sort) {
      const value = SORT_VALUE[rule.id];
      if (!value) continue;
      const x = value(a);
      const y = value(b);
      if (x !== y) return (x < y ? -1 : 1) * (rule.desc ? -1 : 1);
    }
    return a.id < b.id ? -1 : 1;
  });
  const start = (query.page - 1) * query.pageSize;
  return { items: sorted.slice(start, start + query.pageSize), total: rows.length };
}

const targetIds = (target: BulkTarget): Set<string> =>
  target.mode === 'ids'
    ? new Set(target.ids)
    : new Set(
        matching(target.query)
          .map((u) => u.id)
          .filter((id) => !target.excludedIds.includes(id)),
      );

export async function mockSetStatus(target: BulkTarget, status: AdminUserStatus): Promise<number> {
  await new Promise((r) => setTimeout(r, 300));
  const ids = targetIds(target);
  users = users.map((u) =>
    ids.has(u.id) ? { ...u, status, sessions: status === 'suspended' ? 0 : u.sessions } : u,
  );
  return ids.size;
}

export async function mockDeleteUsers(target: BulkTarget): Promise<number> {
  await new Promise((r) => setTimeout(r, 300));
  const ids = targetIds(target);
  users = users.filter((u) => !ids.has(u.id));
  return ids.size;
}

# Data table

`src/components/data-table/` — the one table every list page uses (users, roles, sessions, audit log …). Hand-built (no table library), server-side paging / sorting / filtering, every state handled. Reference implementation: `src/features/admin-users/pages/UsersListPage.tsx` (mock data until the admin users API is wired).

## Use it

```tsx
const FILTERS: DataTableFilter[] = [{ id: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }] }];
const COLUMNS: DataTableColumn<User>[] = [
  { id: 'name', header: 'Name', sortable: true, width: 240, mobile: 'title', cell: (u) => u.name },
  { id: 'email', header: 'Email', sortable: true, mobile: 'subtitle', cell: (u) => u.email },
  { id: 'sessions', header: 'Sessions', sortable: true, numeric: true, cell: (u) => u.sessions },
];

function UsersPage() {
  const table = useServerTable({ fetchPage: usersApi.list, getRowId: (u) => u.id, filters: FILTERS,
    defaultSort: [{ id: 'createdAt', desc: true }], itemsLabel: 'users' });
  return (
    <DataTable table={table} columns={COLUMNS} layoutKey={`users:${user.id}`}
      itemName={{ singular: 'user', plural: 'users' }} rowLabel={(u) => u.name}
      onRowOpen={openDetails} rowActions={renderRowActions} bulkActions={bulkActions}
      emptyState={{ title: 'No users yet', description: '…', action: <InviteButton /> }} />
  );
}
```

- `fetchPage(query, signal)` gets `{ page, pageSize, search, sort: [{ id, desc }], filters: { status: ['active'] } }` and returns `{ items, total }`. Map it to the API in `features/<area>/api/*.api.ts` (e.g. `GET /admin/users?page&limit&search&sort=name:asc,createdAt:desc&status=active`).
- Keep `columns`, `filters` and `fetchPage` stable (module constants / stable API functions).
- Column ids are the server's sort keys.
- Test states in development: `?mock=error`, `?mock=empty` (users mock).

## Checklist → where it lives

| Checklist item | How |
| --- | --- |
| Right format | Tables for comparable records with many attributes; small sets / rich items → cards or a list (`EmptyState`, `Card`). |
| Aligned cells | `numeric: true` → right-aligned, tabular figures; text left; dates via `DateCell` (relative + exact on hover / for screen readers). |
| Density | Compact / comfortable / spacious in the view options; remembered per user (`layoutKey` includes the user id). |
| Touch targets | Checkboxes and row actions: ≥ 24 px hit area (WCAG 2.2 target size), ≥ 44 px on touch screens (`pointer-coarse:`); rows ≥ 44 px on touch. |
| Hover | Opaque row tint, 100 ms color transition (no flicker; frozen cells stay opaque). |
| Focus | Rows are focusable (roving tabindex), 2 px outline ring — not color alone. |
| Selected | Tint + checked box + accent bar; survives paging and sorting (cleared only when search / filters change the scope). |
| Loading | Skeleton rows in the real column widths; refetch keeps the previous rows dimmed + a thin progress bar (layout never jumps). |
| Empty | First run (`emptyState` with the next action) vs no results (“Clear filters”). |
| Error | `ErrorState` with “Try again” instead of the grid — never half-rendered. |
| Sort indicators | Arrow per sorted column; multi-sort (Shift+click) shows the priority number; `aria-sort` on headers. |
| Sort scope | Always server-side (`query.sort`) — the client never sorts one page. |
| Visible filters | Filter dropdowns always in the toolbar (count badge); active filters as chips with the count and “Clear all”. |
| Pagination clarity | `Pagination` always shows “26–50 of 243” and rows per page (10 / 25 / 50 / 100). |
| Selection model | Header checkbox = this page; then “Select all 243 users” switches to *all matching* (`{ mode: 'all', excludedIds, query }` for bulk actions). |
| Bulk actions | Toolbar appears with the selection; `destructive` / `confirm` actions open `ConfirmDialog` with the count. |
| Sticky orientation | Header pinned (z-20), select + first column frozen left, actions frozen right (z-30 at the corners, z-10 in the body). |
| Layout persistence | Column resize (drag or ← / → on the handle), reorder (up / down) and hide in the view options; stored in `dataTables` (`lib/constants/storage-keys.ts`). |
| Mobile | Below `md`: cards (title, subtitle, label / value fields, actions) + “Sort by” picker — not a shrunken grid. |
| Semantic markup | Native `<table>`, `<caption>`, `th scope="col"`, `aria-rowcount` / `aria-rowindex`, `aria-selected`; ↑ / ↓ / Home / End, Space selects, Enter opens; live region announces results, sort and selection. |
| Performance | Server paging only, page size ≤ 100 — the DOM never holds more than 100 rows (no virtualization needed). Add virtualization only for an unpaged view of > ~1,000 rows. |
| No anti-patterns | Text ≥ 13 px (compact) / 14 px; row actions always visible (⋯), never hover-only; filters always visible. |

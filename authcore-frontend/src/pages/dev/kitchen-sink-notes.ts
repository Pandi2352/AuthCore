/**
 * Usage notes shown under each section of /dev/ui (development only).
 * Keep them short: when to use what, the rules, one example. Update them with the component.
 */
export interface UsageNote {
  /** When to use which component. */
  when: string[];
  /** Project rules that apply. */
  rules?: string[];
  /** A minimal, copyable example. */
  example: string;
}

export const KITCHEN_SINK_NOTES: Record<string, UsageNote> = {
  'ks-theme': {
    when: [
      'Theme settings for the whole app; users change theirs on /settings/appearance.',
      'Defaults live in config/theme.config.ts (preset, mode, appearance) — not in components.',
    ],
    rules: [
      'Check every preset × light / dark before a release; npm run check:contrast checks colors.',
      'Components use semantic tokens only (bg-surface, text-muted-foreground, border-border, bg-primary …).',
    ],
    example: `import { useTheme } from '@/app/theme';

const { resolvedMode, setMode } = useTheme();
setMode('dark'); // 'light' | 'dark' | 'system'`,
  },

  'ks-buttons': {
    when: [
      'Button: actions. variant solid (main action, one per area), outline / secondary (others), ghost (toolbars), destructive (delete), link (inline).',
      'IconButton: icon-only actions — aria-label is required (it is the accessible name and the tooltip text).',
      'Navigation is a link: <Button asChild><Link to={paths.x}>…</Link></Button>.',
    ],
    rules: [
      'isLoading while the action runs (disables + spinner + aria-busy); never disable without a reason.',
      'Tooltip wraps one focusable element and opens on hover and keyboard focus.',
    ],
    example: `<Button leftIcon={<Plus />} isLoading={saving} onClick={save}>Add user</Button>
<IconButton aria-label="Delete" icon={<Trash2 />} variant="ghost" />
<Tooltip content="Copy link"><IconButton aria-label="Copy link" icon={<Copy />} /></Tooltip>`,
  },

  'ks-forms': {
    when: [
      'Input / PasswordInput / Textarea with label, hint and error props (they wrap themselves in a Field).',
      'Field: label + description + error around any other control (Select, Combobox, RadioGroup).',
      'Select: pick one of a fixed list (≤ ~15). Combobox: long or searchable lists, or options loaded while typing (onSearchChange + filterLocally={false}).',
      'Checkbox: one yes / no inside a form. Switch: a setting that applies at once. RadioGroup: 2–5 visible choices.',
    ],
    rules: [
      'Never a native <select> (check:architecture fails) — use Select / Combobox.',
      'Server validation errors: useApiError() → error={fieldError("email")} on the input, <ErrorAlert fields={[…]}> above the form.',
      'Every control needs a visible label or an aria-label.',
    ],
    example: `<Input label="Email" type="email" required error={fieldError('email')} />
<Field label="Country" error={fieldError('country')}>
  <Select options={countries} value={country} onValueChange={setCountry} clearable />
</Field>
<Switch label="Notifications" checked={on} onCheckedChange={setOn} />`,
  },

  'ks-overlays': {
    when: [
      'Dialog: a focused task (edit form). AlertDialog / ConfirmDialog: confirm a destructive action (ConfirmDialog adds confirmPhrase for irreversible ones).',
      'Sheet: side panels (filters, details) — keeps the page visible.',
      'DropdownMenu: a list of actions for one thing (row menu, user menu). Popover: small interactive content (quick edit).',
      'CommandPalette: global search / commands (the app one is in the navbar, Ctrl+K).',
    ],
    rules: [
      'Focus is trapped and restored, Escape closes, scroll is locked — do not re-implement.',
      'Dialog titles are required for screen readers (title prop).',
      'Use asChild on triggers to keep our Button.',
    ],
    example: `<ConfirmDialog
  trigger={<Button variant="destructive">Delete</Button>}
  title="Delete this user?"
  description="This cannot be undone."
  confirmText="Delete"
  destructive
  onConfirm={() => usersApi.remove(id)}
/>
<DropdownMenu>
  <DropdownMenuTrigger asChild><IconButton aria-label="Actions" icon={<MoreHorizontal />} /></DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem icon={<Pencil />} onSelect={edit}>Edit</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`,
  },

  'ks-feedback': {
    when: [
      'Alert: a message that stays in the page (warning, info, form result). For API errors in forms use ErrorAlert.',
      'toast: short confirmation of an action ("Saved"); for failed actions use notifyError(err, fallback).',
      'Progress: known progress (upload); without value it is indeterminate. Spinner: inside buttons / small areas. Skeleton: the shape of content while it loads.',
    ],
    rules: [
      'Do not toast page-load errors — render <ErrorState error onRetry> instead.',
      'Loading regions: LoadingState for whole sections (it announces itself).',
    ],
    example: `toast.success('Profile updated');
notifyError(err, 'Could not revoke the session');
<Alert variant="warning" title="Unverified email" message="Verify your email to enable recovery." />
<Progress value={percent} label="Uploading" showValue />`,
  },

  'ks-display': {
    when: [
      'Card: group related content; its default variant comes from the theme (appearance.cards).',
      'Badge: short status / count (StatusBadge maps API statuses to tones). Avatar: user image with initials fallback.',
      'Tabs: switch views of the same thing (keep the tab in the URL with useQueryParams for deep links). Accordion: optional details, FAQs.',
      'Breadcrumb: built automatically from route handle.breadcrumb — only use it directly in special pages.',
    ],
    rules: ['rounded-md everywhere (rounded-full only for circles: avatars, dots); no shadows.'],
    example: `<Card>
  <CardHeader><CardTitle>Sessions</CardTitle></CardHeader>
  <CardContent>…</CardContent>
</Card>
<Badge tone="success" dot>Active</Badge>
<Tabs value={tab} onValueChange={setTab}>
  <TabsList><TabsTrigger value="overview">Overview</TabsTrigger></TabsList>
  <TabsContent value="overview">…</TabsContent>
</Tabs>`,
  },

  'ks-page': {
    when: [
      'Every page: PageContainer → PageHeader (title, description, actions) → PageSection(s).',
      'One state at a time per data area: LoadingState → ErrorState (with onRetry) → EmptyState → content.',
      'ErrorState handles 403 (no access), 404 (not found), offline and 5xx (reference id) by itself.',
    ],
    rules: [
      'Loaders pass an AbortSignal and abort on unmount; cancelled requests are ignored by ErrorState.',
      'Actions inside a page: notifyError / notifySuccess (toasts), not page alerts.',
    ],
    example: `<PageContainer>
  <PageHeader title="Users" actions={<Button leftIcon={<Plus />}>Invite</Button>} />
  {isLoading ? <LoadingState variant="table" label="Loading users" />
    : error ? <ErrorState error={error} onRetry={load} />
    : users.length === 0 ? <EmptyState title="No users yet" />
    : <UsersTable users={users} />}
</PageContainer>`,
  },

  'ks-hooks': {
    when: [
      'useDisclosure: open / close state for dialogs and panels. useDebouncedValue: search inputs.',
      'useQueryParams / useUrlPagination: filters and pages that survive reload and can be shared.',
      'useLocalStorage: per-user UI preferences (register the key in lib/constants/storage-keys.ts first).',
      'useApiError: error state for forms (keeps field errors and the request id).',
    ],
    rules: [
      'Hooks in src/hooks have no business logic; feature hooks live in features/<area>/hooks.',
    ],
    example: `const search = useDebouncedValue(query, 300);
const { page, pageSize, setPage } = useUrlPagination({ total });
const { error, setError, fieldError } = useApiError();`,
  },

  'ks-table': {
    when: [
      'Table primitives for lists: TableHead sortable for server or local sorting, TableLoadingRows while loading, TableEmpty when there are no rows.',
      'Pagination under the table; with the page in the URL via useUrlPagination. (A full DataTable comes in Level 2.)',
    ],
    rules: [
      'Clickable rows need cursor-pointer and a real link or button inside for keyboard users.',
      'Lists from the API use apiClient.getPage → { items, meta } (meta.totalItems for Pagination total).',
    ],
    example: `<Table>
  <TableHeader><TableRow>
    <TableHead sortable sortDirection={sort} onSort={toggleSort}>Name</TableHead>
  </TableRow></TableHeader>
  <TableBody>
    {isLoading ? <TableLoadingRows rows={5} columns={3} />
      : items.length === 0 ? <TableEmpty colSpan={3} title="No users found" />
      : items.map((u) => <TableRow key={u.id}><TableCell>{u.name}</TableCell></TableRow>)}
  </TableBody>
</Table>
<Pagination page={page} total={meta.totalItems} pageSize={pageSize} onPageChange={setPage} />`,
  },
};

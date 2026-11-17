import {
  Bell,
  Copy,
  Download,
  Mail,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { ThemeCustomizer } from '@/components/common/ThemeCustomizer';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDialog,
  Avatar,
  AvatarGroup,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Combobox,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Field,
  IconButton,
  Input,
  Kbd,
  Pagination,
  PasswordInput,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  Progress,
  RadioGroup,
  ScrollArea,
  Select,
  Separator,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetTrigger,
  Skeleton,
  SkeletonText,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableLoadingRows,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
  Tooltip,
  type SortDirection,
} from '@/components/ui';
import { appConfig } from '@/config';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2 id={id} className="text-lg font-semibold text-foreground">
        {title}
      </h2>
      <div className="rounded-md border border-border bg-surface p-card">{children}</div>
    </section>
  );
}

const Row = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-wrap items-center gap-3">{children}</div>
);

const COUNTRIES = [
  { value: 'in', label: 'India' },
  { value: 'us', label: 'United States' },
  { value: 'gb', label: 'United Kingdom' },
  { value: 'de', label: 'Germany' },
  { value: 'jp', label: 'Japan', disabled: true },
  { value: 'sg', label: 'Singapore' },
  { value: 'ae', label: 'United Arab Emirates' },
];

const ROLES = [
  {
    label: 'Staff',
    options: [
      { value: 'admin', label: 'Administrator', description: 'Full access', icon: <Settings /> },
      { value: 'editor', label: 'Editor', description: 'Can edit content', icon: <Pencil /> },
    ],
  },
  {
    label: 'Others',
    options: [{ value: 'viewer', label: 'Viewer', description: 'Read only', icon: <UserRound /> }],
  },
];

const PEOPLE = [
  { name: 'Priya Raman', email: 'priya@example.com', role: 'Admin', status: 'Active' },
  { name: 'Arjun Kumar', email: 'arjun@example.com', role: 'Editor', status: 'Invited' },
  { name: 'Meera Nair', email: 'meera@example.com', role: 'Viewer', status: 'Suspended' },
];

/** Every UI component in one place: check each preset × mode × appearance before a release. */
export function UiKitchenSinkPage() {
  const [country, setCountry] = useState<string | null>('in');
  const [role, setRole] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const [plan, setPlan] = useState('pro');
  const [showStatus, setShowStatus] = useState(true);
  const [density, setDensity] = useState('comfortable');
  const [sort, setSort] = useState<SortDirection>('asc');
  const [page, setPage] = useState(3);
  const [pageSize, setPageSize] = useState(10);
  const [bio, setBio] = useState('');
  const [tab, setTab] = useState('overview');

  const rows = PEOPLE.toSorted((a, b) =>
    sort === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">UI kit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Development only. Switch the theme here and check every component in each preset and mode.
        </p>
      </div>

      <Section id="ks-theme" title="Theme">
        <ThemeCustomizer />
      </Section>

      <Section id="ks-buttons" title="Buttons">
        <div className="space-y-4">
          <Row>
            <Button variant="solid">Solid</Button>
            <Button variant="soft">Soft</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive" leftIcon={<Trash2 />}>
              Delete
            </Button>
          </Row>
          <Row>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button isLoading>Saving</Button>
            <Button disabled>Disabled</Button>
            <Button leftIcon={<Plus />}>Add user</Button>
            <Button variant="outline" rightIcon={<Download />}>
              Export
            </Button>
          </Row>
          <Row>
            <IconButton aria-label="Search" icon={<Search />} />
            <IconButton aria-label="Notifications" icon={<Bell />} variant="outline" />
            <IconButton aria-label="Copy" icon={<Copy />} variant="soft" size="sm" />
            <Tooltip content="Tooltips open on hover and keyboard focus">
              <Button variant="outline">Hover or focus me</Button>
            </Tooltip>
            <span className="text-sm text-muted-foreground">
              Shortcut: <Kbd>Ctrl</Kbd> + <Kbd>B</Kbd>
            </span>
          </Row>
        </div>
      </Section>

      <Section id="ks-forms" title="Form controls">
        <div className="grid gap-form md:grid-cols-2">
          <Input
            label="Full name"
            placeholder="Priya Raman"
            hint="As shown on your profile."
            required
          />
          <Input
            label="Email"
            type="email"
            prefix={<Mail />}
            placeholder="name@company.com"
            error="Enter a valid email address"
          />
          <Field label="Password" description="At least 8 characters.">
            <PasswordInput placeholder="••••••••" autoComplete="new-password" />
          </Field>
          <Input label="Small, disabled" size="sm" disabled defaultValue="Read only" />
          <Field
            label="Country (select)"
            description="Custom listbox: arrows, Home/End, type to jump."
          >
            <Select options={COUNTRIES} value={country} onValueChange={setCountry} clearable />
          </Field>
          <Field label="Role (grouped, with descriptions)">
            <Select
              options={ROLES}
              value={role}
              onValueChange={setRole}
              placeholder="Choose a role"
            />
          </Field>
          <Field label="City (combobox)" description="Type to filter.">
            <Combobox
              options={[
                'Chennai',
                'Bengaluru',
                'Mumbai',
                'Delhi',
                'Hyderabad',
                'Pune',
                'Kochi',
              ].map((c) => ({
                value: c.toLowerCase(),
                label: c,
              }))}
              value={city}
              onValueChange={setCity}
            />
          </Field>
          <Field label="Invalid select" error="Choose an option">
            <Select options={COUNTRIES} />
          </Field>
          <Field label="Bio" description="Grows with the text." className="md:col-span-2">
            <Textarea
              autoResize
              maxLength={200}
              showCount
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </Field>
          <div className="space-y-3">
            <Checkbox
              label="Email me about security events"
              description="New sign-ins, password changes"
              defaultChecked
            />
            <Checkbox label="Select all (indeterminate)" indeterminate />
            <Checkbox label="Disabled" disabled />
          </div>
          <div className="space-y-4">
            <RadioGroup
              aria-label="Plan"
              value={plan}
              onValueChange={setPlan}
              options={[
                { value: 'free', label: 'Free', description: 'Up to 3 users' },
                { value: 'pro', label: 'Pro', description: 'Unlimited users' },
                { value: 'enterprise', label: 'Enterprise', disabled: true },
              ]}
            />
            <Switch
              label="Notifications"
              description="Push notifications on this device"
              checked={notify}
              onCheckedChange={setNotify}
            />
            <Switch size="sm" aria-label="Small switch" defaultChecked />
          </div>
        </div>
      </Section>

      <Section id="ks-overlays" title="Overlays">
        <Row>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent title="Edit profile" description="Changes are saved to your account.">
              <DialogBody className="space-y-4">
                <Input label="First name" defaultValue="Priya" />
                <Field label="Country">
                  <Select options={COUNTRIES} defaultValue="in" />
                </Field>
              </DialogBody>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button onClick={() => toast.success('Profile saved')}>Save</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog
            trigger={<Button variant="destructive">Delete account…</Button>}
            title="Delete this account?"
            description="This permanently removes the account and its data. This cannot be undone."
            actionText="Delete"
            destructive
            onAction={() =>
              new Promise((resolve) => setTimeout(resolve, 800)).then(() =>
                toast.success('Account deleted'),
              )
            }
          />

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Open sheet</Button>
            </SheetTrigger>
            <SheetContent title="Filters" description="Narrow down the list." size="md">
              <SheetBody className="space-y-4">
                <Field label="Status">
                  <Select
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'invited', label: 'Invited' },
                    ]}
                  />
                </Field>
                <Checkbox label="Only verified emails" />
              </SheetBody>
              <SheetFooter>
                <Button>Apply</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Dropdown menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem icon={<Pencil />} shortcut="Ctrl+E" onSelect={() => toast('Edit')}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={<Copy />}
                shortcut="Ctrl+D"
                onSelect={() => toast('Duplicated')}
              >
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem icon={<Download />} disabled>
                Export (disabled)
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger icon={<Settings />}>Table density</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={density} onValueChange={setDensity}>
                    <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={showStatus} onCheckedChange={setShowStatus}>
                Show status column
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                icon={<Trash2 />}
                onSelect={() => toast.error('Deleted')}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Popover</Button>
            </PopoverTrigger>
            <PopoverContent className="space-y-3">
              <p className="text-sm font-medium text-foreground">Quick note</p>
              <Textarea rows={2} placeholder="Write something…" />
              <div className="flex justify-end">
                <PopoverClose asChild>
                  <Button size="sm">Done</Button>
                </PopoverClose>
              </div>
            </PopoverContent>
          </Popover>
        </Row>
      </Section>

      <Section id="ks-feedback" title="Feedback">
        <div className="space-y-4">
          <Alert variant="info" title="Heads up" message="Your session will expire in 5 minutes." />
          <Alert variant="success" message="Password changed." onClose={() => undefined} />
          <Alert
            variant="warning"
            title="Unverified email"
            message="Verify your email to enable recovery."
            action={
              <Button size="sm" variant="outline">
                Resend
              </Button>
            }
          />
          <Alert variant="danger" title="Sign-in failed" message="Wrong email or password." />
          <Row>
            <Button variant="outline" onClick={() => toast('Saved as draft')}>
              Toast
            </Button>
            <Button
              variant="outline"
              onClick={() => toast.success('Invitation sent', { description: 'arjun@example.com' })}
            >
              Success
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.error('Could not save', {
                  action: { label: 'Retry', onClick: () => toast('Retrying…') },
                })
              }
            >
              Error
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void toast.promise(new Promise((r) => setTimeout(r, 1500)), {
                  loading: 'Uploading…',
                  success: 'Uploaded',
                  error: 'Failed',
                })
              }
            >
              Promise
            </Button>
          </Row>
          <div className="grid gap-4 md:grid-cols-2">
            <Progress value={45} label="Upload" showValue />
            <Progress label="Processing" />
            <Progress value={80} tone="success" size="sm" label="Storage" />
            <div className="flex items-center gap-3 text-primary">
              <Spinner size="sm" /> <Spinner /> <Spinner size="lg" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <SkeletonText lines={2} className="flex-1" />
            </div>
            <SkeletonText lines={3} />
          </div>
        </div>
      </Section>

      <Section id="ks-display" title="Display">
        <div className="space-y-6">
          <Row>
            {(['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const).map(
              (tone) => (
                <Badge key={tone} tone={tone} dot>
                  {tone}
                </Badge>
              ),
            )}
          </Row>
          <Row>
            <Badge variant="solid" tone="primary">
              Solid
            </Badge>
            <Badge variant="outline" tone="success">
              Outline
            </Badge>
            <Badge size="sm">Small</Badge>
          </Row>
          <Row>
            <Avatar name="Priya Raman" size="xs" />
            <Avatar name="Priya Raman" size="sm" status="online" />
            <Avatar name="Arjun Kumar" status="away" />
            <Avatar name="Meera" size="lg" status="busy" />
            <Avatar name="Broken image" src="/does-not-exist.png" size="xl" />
            <AvatarGroup max={3}>
              <Avatar name="Priya Raman" />
              <Avatar name="Arjun Kumar" />
              <Avatar name="Meera Nair" />
              <Avatar name="Ravi S" />
              <Avatar name="Kavya" />
            </AvatarGroup>
          </Row>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(['bordered', 'filled', 'elevated', 'minimal'] as const).map((variant) => (
              <Card key={variant} variant={variant}>
                <CardHeader>
                  <div>
                    <CardTitle className="capitalize">{variant}</CardTitle>
                    <CardDescription>Card variant</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  Content uses theme tokens.
                </CardContent>
                <CardFooter>
                  <Button size="sm" variant="ghost">
                    Action
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          <Separator />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#ks-display">Administration</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="#ks-display">Users</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Priya Raman</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="disabled" disabled>
                Disabled
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="text-sm text-muted-foreground">
              Overview panel (←/→ to switch).
            </TabsContent>
            <TabsContent value="security" className="text-sm text-muted-foreground">
              Security panel.
            </TabsContent>
            <TabsContent value="sessions" className="text-sm text-muted-foreground">
              Sessions panel.
            </TabsContent>
          </Tabs>
          <Tabs defaultValue="a" variant="pills">
            <TabsList>
              <TabsTrigger value="a">Pills</TabsTrigger>
              <TabsTrigger value="b">Variant</TabsTrigger>
            </TabsList>
          </Tabs>
          <Accordion type="single" defaultValue={['q1']}>
            <AccordionItem value="q1">
              <AccordionTrigger>What is {appConfig.name}?</AccordionTrigger>
              <AccordionContent>
                A reusable authentication and authorization service.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q2">
              <AccordionTrigger>Can I change the theme?</AccordionTrigger>
              <AccordionContent>
                Yes: theme.config.ts, and users on the Appearance page.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <ScrollArea
            maxHeight="8rem"
            className="border border-border p-3 text-sm text-muted-foreground"
            aria-label="Scrollable log"
          >
            {Array.from({ length: 20 }, (_, i) => (
              <p key={i}>Log line {i + 1}: user signed in from Chennai</p>
            ))}
          </ScrollArea>
        </div>
      </Section>

      <Section id="ks-table" title="Table and pagination">
        <div className="space-y-4">
          <Table stickyHeader wrapperClassName="max-h-72">
            <TableHeader>
              <TableRow>
                <TableHead
                  sortable
                  sortDirection={sort}
                  onSort={() => setSort(sort === 'asc' ? 'desc' : 'asc')}
                >
                  Name
                </TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                {showStatus && <TableHead>Status</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.email}>
                  <TableCell>
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <Avatar name={p.name} size="xs" />
                      {p.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.email}</TableCell>
                  <TableCell>{p.role}</TableCell>
                  {showStatus && (
                    <TableCell>
                      <Badge
                        tone={
                          p.status === 'Active'
                            ? 'success'
                            : p.status === 'Invited'
                              ? 'info'
                              : 'danger'
                        }
                        dot
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              <TableLoadingRows rows={2} columns={showStatus ? 4 : 3} />
            </TableBody>
          </Table>
          <Table>
            <TableBody>
              <TableEmpty
                colSpan={3}
                title="No users found"
                description="Try a different search."
                action={<Button size="sm">Invite user</Button>}
              />
            </TableBody>
          </Table>
          <Pagination
            page={page}
            total={95}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </Section>
    </div>
  );
}

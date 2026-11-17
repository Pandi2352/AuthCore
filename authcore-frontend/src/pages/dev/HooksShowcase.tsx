import { useRef, useState, type ReactNode } from 'react';

import { Badge, Button, Card, Input, Kbd, Pagination } from '@/components/ui';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  useCurrentBreakpoint,
  useIsTouch,
  useMediaQuery,
  usePrefersReducedMotion,
} from '@/hooks/useMediaQuery';
import { useMounted } from '@/hooks/useMounted';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { usePagination, useUrlPagination } from '@/hooks/usePagination';
import { usePrevious } from '@/hooks/usePrevious';
import { useQueryParams } from '@/hooks/useQueryParams';

const toCount = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) ? value : null;

function Row({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-sm last:border-0">
      <code className="font-mono text-xs text-muted-foreground">{name}</code>
      <span className="flex flex-wrap items-center gap-2">{children}</span>
    </div>
  );
}

/** Every generic hook, live, on the kitchen-sink page. */
export function HooksShowcase() {
  const breakpoint = useCurrentBreakpoint();
  const isDarkOs = useMediaQuery('(prefers-color-scheme: dark)');
  const isTouch = useIsTouch();
  const reducedMotion = usePrefersReducedMotion();
  const online = useOnlineStatus();
  const mounted = useMounted();

  const [count, setCount, resetCount] = useLocalStorage('devCounter', 0, { validate: toCount });
  const previousCount = usePrevious(count);

  const [text, setText] = useState('');
  const debounced = useDebouncedValue(text, 500);

  const panel = useDisclosure();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  useClickOutside([panelRef, buttonRef], panel.close, panel.isOpen);

  const { copy, copied } = useCopyToClipboard();
  const [{ tab }, setQuery] = useQueryParams({ tab: 'overview' });
  const [customTitle, setCustomTitle] = useState('');
  useDocumentTitle(customTitle || null);

  const local = usePagination({ total: 95, defaultPageSize: 10 });
  const url = useUrlPagination({ total: 240, defaultPageSize: 20 });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Environment">
        <Row name="useCurrentBreakpoint()">
          <Badge tone="primary">{breakpoint}</Badge>
        </Row>
        <Row name="useMediaQuery('(prefers-color-scheme: dark)')">{String(isDarkOs)}</Row>
        <Row name="useIsTouch()">{String(isTouch)}</Row>
        <Row name="usePrefersReducedMotion()">{String(reducedMotion)}</Row>
        <Row name="useOnlineStatus()">
          <Badge tone={online ? 'success' : 'warning'} dot>
            {online ? 'Online' : 'Offline'}
          </Badge>
        </Row>
        <Row name="useMounted()">{String(mounted)}</Row>
      </Card>

      <Card title="State">
        <Row name="useLocalStorage('devCounter') + usePrevious">
          <span>
            {count} <span className="text-muted-foreground">(was {previousCount ?? '—'})</span>
          </span>
          <Button size="sm" variant="outline" onClick={() => setCount((c) => c + 1)}>
            +1
          </Button>
          <Button size="sm" variant="ghost" onClick={resetCount}>
            Reset
          </Button>
        </Row>
        <p className="py-1 text-xs text-muted-foreground">
          Open this page in a second tab: the counter stays in sync.
        </p>
        <Row name="useDebouncedValue(text, 500)">
          <span className="w-40">
            <Input
              size="sm"
              aria-label="Type to debounce"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </span>
          <span className="text-muted-foreground">→ “{debounced}”</span>
        </Row>
        <Row name="useQueryParams({ tab })">
          {['overview', 'members'].map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tab === t ? 'solid' : 'outline'}
              onClick={() => setQuery({ tab: t })}
            >
              {t}
            </Button>
          ))}
        </Row>
      </Card>

      <Card title="Interaction">
        <Row name="useDisclosure + useClickOutside">
          <div className="relative">
            <Button
              ref={buttonRef}
              size="sm"
              variant="outline"
              onClick={panel.toggle}
              aria-expanded={panel.isOpen}
            >
              {panel.isOpen ? 'Close panel' : 'Open panel'}
            </Button>
            {panel.isOpen && (
              <div
                ref={panelRef}
                className="absolute top-full right-0 z-10 mt-2 w-56 rounded-md border border-border bg-surface p-3 text-xs shadow-popover"
              >
                Click anywhere outside to close.
              </div>
            )}
          </div>
        </Row>
        <Row name="useCopyToClipboard">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void copy('Hello from the hooks showcase')}
          >
            {copied ? 'Copied!' : 'Copy text'}
          </Button>
        </Row>
        <Row name="useDocumentTitle">
          <span className="w-40">
            <Input
              size="sm"
              aria-label="Tab title"
              placeholder="Tab title"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
            />
          </span>
        </Row>
        <p className="py-1 text-xs text-muted-foreground">
          Global shortcuts: <Kbd>Ctrl</Kbd>+<Kbd>K</Kbd> command menu, <Kbd>Ctrl</Kbd>+<Kbd>B</Kbd>{' '}
          sidebar (useEventListener).
        </p>
      </Card>

      <Card title="Pagination">
        <p className="mb-2 text-xs text-muted-foreground">
          usePagination (local): page {local.page}/{local.pageCount}, offset {local.offset}, showing{' '}
          {local.from}–{local.to}
        </p>
        <Pagination
          page={local.page}
          total={local.total}
          pageSize={local.pageSize}
          onPageChange={local.setPage}
          onPageSizeChange={local.setPageSize}
        />
        <p className="mt-4 mb-2 text-xs text-muted-foreground">
          useUrlPagination (in the URL): page {url.page}/{url.pageCount}, size {url.pageSize}
        </p>
        <Pagination
          page={url.page}
          total={url.total}
          pageSize={url.pageSize}
          onPageChange={url.setPage}
          onPageSizeChange={url.setPageSize}
        />
      </Card>
    </div>
  );
}

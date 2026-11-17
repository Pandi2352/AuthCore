import { Hammer } from 'lucide-react';
import { Link, useMatches } from 'react-router-dom';

import { Button } from '@/components/ui';
import { paths } from '@/config';

import { StatusPage } from './StatusPage';

/** "Not built yet": shown for navigation items with status 'planned' (generated routes). */
export function PlannedFeaturePage() {
  const matches = useMatches();
  const handle = (matches[matches.length - 1]?.handle ?? {}) as {
    title?: string;
    description?: string;
  };
  const title = handle.title ?? 'This page';
  return (
    <StatusPage
      icon={<Hammer aria-hidden="true" />}
      code="Coming soon"
      title={title}
      description={
        handle.description ??
        `${title} is planned but not built yet. It appears here because it is listed in the navigation configuration.`
      }
      actions={
        <Button variant="outline" asChild>
          <Link to={paths.dashboard}>Back to dashboard</Link>
        </Button>
      }
    />
  );
}

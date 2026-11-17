import { ArrowLeft } from 'lucide-react';
import { Link, useMatches, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui';
import { paths } from '@/config';

import { StatusPage } from './StatusPage';

/** "Not built yet": shown for navigation items with status 'planned' (generated routes). */
export function PlannedFeaturePage() {
  const matches = useMatches();
  const navigate = useNavigate();
  const handle = (matches[matches.length - 1]?.handle ?? {}) as {
    title?: string;
    description?: string;
  };
  const title = handle.title ?? 'This feature';
  return (
    <StatusPage
      code="Coming soon"
      title={`${title}!`}
      description={
        handle.description ??
        'Oops! This module is actively in development. It will be available in an upcoming release.'
      }
      actions={
        <>
          <Button asChild size="md">
            <Link to={paths.dashboard}>Go to dashboard</Link>
          </Button>
          <Button variant="outline" size="md" leftIcon={<ArrowLeft />} onClick={() => navigate(-1)}>
            Go back
          </Button>
        </>
      }
    />
  );
}

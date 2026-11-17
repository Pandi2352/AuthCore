import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui';
import { paths } from '@/config';

import { StatusPage } from './StatusPage';

/** 404. `embedded` = inside the app layout (sidebar stays); otherwise full screen. */
export function NotFoundPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  return (
    <StatusPage
      fullScreen={!embedded}
      code="404"
      title="Page not found!"
      description="Oops! It looks like the page you're trying to reach is not available. Please check the URL or return to the homepage."
      actions={
        <>
          <Button asChild size="md">
            <Link to={paths.root}>Go Homepage</Link>
          </Button>
          <Button variant="outline" size="md" leftIcon={<ArrowLeft />} onClick={() => navigate(-1)}>
            Go back
          </Button>
        </>
      }
    />
  );
}

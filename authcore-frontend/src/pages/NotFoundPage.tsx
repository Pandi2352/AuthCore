import { ArrowLeft, Compass } from 'lucide-react';
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
      icon={<Compass aria-hidden="true" />}
      code="404"
      title="Page not found"
      description="The page you are looking for doesn't exist or has been moved."
      actions={
        <>
          <Button variant="outline" leftIcon={<ArrowLeft />} onClick={() => navigate(-1)}>
            Go back
          </Button>
          <Button asChild>
            <Link to={paths.root}>Go to home</Link>
          </Button>
        </>
      }
    />
  );
}

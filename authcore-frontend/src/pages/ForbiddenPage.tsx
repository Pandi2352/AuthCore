import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui';
import { paths } from '@/config';

import { StatusPage } from './StatusPage';

/** 403: signed in, but without the permission this page needs. */
export function ForbiddenPage() {
  const navigate = useNavigate();
  return (
    <StatusPage
      code="403"
      title="Access denied!"
      description="Oops! It looks like you don't have permission to access this page. Please check your credentials or contact an administrator."
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

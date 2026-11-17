import { ShieldX } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui';
import { appConfig, paths } from '@/config';

import { StatusPage } from './StatusPage';

/** 403: signed in, but without the permission this page needs. */
export function ForbiddenPage() {
  return (
    <StatusPage
      icon={<ShieldX aria-hidden="true" />}
      code="403"
      title="Access denied"
      description={
        <>
          You don't have permission to view this page. If you need access, ask an administrator
          {appConfig.branding.supportEmail ? (
            <>
              {' '}
              or contact{' '}
              <a
                className="cursor-pointer text-primary underline-offset-4 hover:underline"
                href={`mailto:${appConfig.branding.supportEmail}`}
              >
                {appConfig.branding.supportEmail}
              </a>
            </>
          ) : null}
          .
        </>
      }
      actions={
        <Button asChild>
          <Link to={paths.dashboard}>Back to dashboard</Link>
        </Button>
      }
    />
  );
}

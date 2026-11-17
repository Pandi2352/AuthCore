import React from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/common/Button';
import { paths } from '@/config';

export const NotFound: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <h1 className="mb-2 text-6xl font-black text-primary">404</h1>
      <h2 className="mb-2 text-2xl font-bold text-foreground">Page Not Found</h2>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to={paths.dashboard}>
        <Button variant="primary">Return Home</Button>
      </Link>
    </div>
  );
};

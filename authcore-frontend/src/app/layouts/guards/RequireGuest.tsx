import { Loader2 } from 'lucide-react';
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { paths } from '@/config';
import { useAuth } from '@/context/AuthContext';

interface GuestRouteProps {
  children: React.ReactNode;
}

export const GuestRoute: React.FC<GuestRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    const from =
      (location.state as { from?: { pathname: string } })?.from?.pathname || paths.dashboard;
    return <Navigate to={from} replace />;
  }

  return <>{children}</>;
};

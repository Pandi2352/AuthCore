import { Loader2 } from 'lucide-react';
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { paths } from '@/config';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredRole?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredRole,
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { hasPermission, hasRole } = usePermissions();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={paths.auth.login} state={{ from: location }} replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to={paths.dashboard} replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to={paths.dashboard} replace />;
  }

  return <>{children}</>;
};

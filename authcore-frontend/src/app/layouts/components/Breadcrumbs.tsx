import { Fragment } from 'react';
import { Link } from 'react-router-dom';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui';
import { featuresConfig, layoutConfig } from '@/config';
import { cn } from '@/lib/utils';

import { useBreadcrumbs } from './use-breadcrumbs';

/** Navbar breadcrumbs; toggled by features.ui.breadcrumbs + layout.navbar.showBreadcrumbs. */
export function Breadcrumbs({ className }: { className?: string }) {
  const crumbs = useBreadcrumbs();
  if (!featuresConfig.ui.breadcrumbs || !layoutConfig.navbar.showBreadcrumbs || crumbs.length === 0)
    return null;
  return (
    <Breadcrumb className={cn('min-w-0', className)}>
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.href ?? ''}|${crumb.label}`}>
              <BreadcrumbItem className={cn(!isLast && 'hidden md:inline-flex')}>
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : crumb.href ? (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <span className="truncate">{crumb.label}</span>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator className="hidden md:inline-flex" />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

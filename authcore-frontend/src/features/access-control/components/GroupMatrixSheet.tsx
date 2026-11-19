import { Check, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ErrorState, LoadingState } from '@/components/feedback';
import { Badge, Sheet, SheetBody, SheetContent } from '@/components/ui';

import { groupsApi } from '../api/groups.api';
import type { PermissionMatrix } from '../types/access-control.types';

export function GroupMatrixSheet({
  groupId,
  open,
  onOpenChange,
}: {
  groupId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    if (!groupId || !open) return;
    const controller = new AbortController();

    const loadMatrix = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await groupsApi.permissionMatrix(groupId, undefined, controller.signal);
        setMatrix(data);
      } catch (err) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    void loadMatrix();
    return () => controller.abort();
  }, [groupId, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={matrix ? `${matrix.groupName} · Permission Matrix` : 'Permission Matrix'}
        description="Comprehensive evaluation of all permissions granted through direct and inherited roles."
        size="xl"
      >
        <SheetBody className="space-y-6">
          {isLoading ? (
            <LoadingState label="Computing permission matrix" />
          ) : error ? (
            <ErrorState error={error} title="Could not load permission matrix" />
          ) : matrix ? (
            <>
              <section
                aria-label="Assigned roles"
                className="space-y-3 rounded-md border border-border p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    Assigned roles ({matrix.roles.length})
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Source of granted permissions
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {matrix.roles.map((r) => (
                    <div
                      key={r.id}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs"
                    >
                      <Shield className="size-3.5 text-primary" />
                      <span className="font-semibold text-foreground">{r.roleName}</span>
                      <code className="text-2xs text-muted-foreground">({r.roleKey})</code>
                      {r.isInherited && (
                        <Badge size="sm" tone="info">
                          Inherited
                        </Badge>
                      )}
                    </div>
                  ))}
                  {matrix.roles.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No roles assigned to this group yet.
                    </p>
                  )}
                </div>
              </section>

              <section
                aria-label="Capabilities grid"
                className="space-y-3 rounded-md border border-border p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    Resource capabilities ({matrix.permissions.length} permissions)
                  </h3>
                  <span className="text-xs text-muted-foreground">Module × Action access grid</span>
                </div>

                {matrix.grid && matrix.grid.length > 0 ? (
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/60 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Module</th>
                          <th className="px-3 py-2 font-semibold">Action</th>
                          <th className="px-3 py-2 text-center font-semibold">Granted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {matrix.grid.map((cell) => (
                          <tr key={`${cell.module}:${cell.action}`} className="hover:bg-muted/30">
                            <td className="px-3 py-2 font-medium text-foreground">{cell.module}</td>
                            <td className="px-3 py-2 font-mono text-muted-foreground">
                              {cell.action}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {cell.isGranted ? (
                                <span className="inline-flex size-5 items-center justify-center rounded-full bg-success/20 text-success">
                                  <Check className="size-3.5" />
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
                    {matrix.permissions.map((p) => (
                      <div key={p.id} className="flex items-center justify-between py-1 text-xs">
                        <span className="font-medium text-foreground">{p.permissionName}</span>
                        <code className="text-2xs rounded-md bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">
                          {p.permissionKey}
                        </code>
                      </div>
                    ))}
                    {matrix.permissions.length === 0 && (
                      <p className="py-3 text-center text-xs text-muted-foreground">
                        No active permissions granted. Assign roles to this group to activate
                        permissions.
                      </p>
                    )}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

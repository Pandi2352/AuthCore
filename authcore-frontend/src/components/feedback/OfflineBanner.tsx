import { WifiOff } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { toast } from '@/components/ui';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * Fixed banner while the browser is offline; a toast when the connection comes back.
 * Mount once (app Providers).
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      toast.success("You're back online");
    }
  }, [isOnline]);

  // The live region stays mounted so the change to "offline" is announced.
  return (
    <div aria-live="polite">
      {!isOnline && (
        <div
          className="fixed inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-warning px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-sm font-medium text-warning-foreground"
          style={{ zIndex: 'var(--z-toast)' }}
        >
          <WifiOff className="size-4 shrink-0" aria-hidden="true" />
          You&apos;re offline. Changes can&apos;t be saved until the connection is back.
        </div>
      )}
    </div>
  );
}

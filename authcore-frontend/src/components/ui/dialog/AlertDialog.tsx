import { useRef, useState, type ReactElement, type ReactNode } from 'react';

import { Button } from '../button';
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from './Dialog';

export interface AlertDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Element that opens the dialog (rendered with asChild). */
  trigger?: ReactElement;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  cancelText?: string;
  actionText?: string;
  /** Red action button (delete, revoke …). */
  destructive?: boolean;
  /** May return a promise: the button shows a spinner and the dialog closes when it resolves. */
  onAction: () => void | Promise<unknown>;
}

/**
 * Confirmation that interrupts the user (role="alertdialog"): no close on backdrop click,
 * focus starts on Cancel (the safe choice), Escape cancels.
 */
export function AlertDialog({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  cancelText = 'Cancel',
  actionText = 'Confirm',
  destructive = false,
  onAction,
}: AlertDialogProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);
  const isOpen = open ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [isBusy, setIsBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  const handleAction = async () => {
    setIsBusy(true);
    try {
      await onAction();
      setOpen(false);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(next) => !isBusy && setOpen(next)}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        role="alertdialog"
        size="sm"
        title={title}
        description={description}
        hideClose
        closeOnOverlayClick={false}
        initialFocus={cancelRef}
      >
        {children && <div className="px-card py-2 text-sm">{children}</div>}
        <DialogFooter>
          <Button
            ref={cancelRef}
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isBusy}
          >
            {cancelText}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'solid'}
            isLoading={isBusy}
            onClick={handleAction}
          >
            {actionText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

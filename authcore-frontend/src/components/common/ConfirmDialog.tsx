import { useId, useState, type ReactElement, type ReactNode } from 'react';

import { AlertDialog, Input } from '@/components/ui';

export interface ConfirmDialogProps {
  /** Element that opens the dialog (button). Or control it with open / onOpenChange. */
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Extra content (e.g. what will be affected). */
  children?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** Red confirm button for deleting / revoking. */
  destructive?: boolean;
  /**
   * For irreversible actions: the user must type this text (e.g. the item name or "DELETE")
   * before the confirm button is enabled.
   */
  confirmPhrase?: string;
  /** May be async: the button spins, the dialog closes when it resolves, stays open on error. */
  onConfirm: () => void | Promise<unknown>;
}

/** "Are you sure?" — AlertDialog with a destructive variant, async confirm and typed confirmation. */
export function ConfirmDialog({
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmPhrase,
  children,
  onOpenChange,
  onConfirm,
  ...props
}: ConfirmDialogProps) {
  const inputId = useId();
  const [typed, setTyped] = useState('');
  const matches = !confirmPhrase || typed.trim() === confirmPhrase;

  return (
    <AlertDialog
      {...props}
      onOpenChange={(open) => {
        if (!open) setTyped('');
        onOpenChange?.(open);
      }}
      onAction={onConfirm}
      actionText={confirmText}
      cancelText={cancelText}
      actionDisabled={!matches}
    >
      {children}
      {confirmPhrase && (
        <div className="mt-3 space-y-1.5">
          <label htmlFor={inputId} className="block text-sm text-muted-foreground">
            Type <strong className="font-mono text-foreground">{confirmPhrase}</strong> to confirm
          </label>
          <Input
            id={inputId}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      )}
    </AlertDialog>
  );
}

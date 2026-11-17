import { forwardRef } from 'react';

import { DialogContent, type DialogContentProps } from '../dialog';

export {
  Dialog as Sheet,
  DialogBody as SheetBody,
  DialogClose as SheetClose,
  DialogDescription as SheetDescription,
  DialogFooter as SheetFooter,
  DialogHeader as SheetHeader,
  DialogTitle as SheetTitle,
  DialogTrigger as SheetTrigger,
} from '../dialog';

export interface SheetContentProps extends Omit<DialogContentProps, 'placement'> {
  side?: 'left' | 'right' | 'top' | 'bottom';
}

/** Side panel (drawer): a modal dialog attached to an edge of the screen. */
export const SheetContent = forwardRef<HTMLDivElement, SheetContentProps>(function SheetContent(
  { side = 'right', ...props },
  ref,
) {
  return <DialogContent ref={ref} placement={side} {...props} />;
});

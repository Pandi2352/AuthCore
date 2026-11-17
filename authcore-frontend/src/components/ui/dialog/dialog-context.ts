import { createContext, useContext, type RefObject } from 'react';

export interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
  triggerRef: RefObject<HTMLElement | null>;
}
export const DialogContext = createContext<DialogContextValue | null>(null);
export const useDialog = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('Dialog parts must be inside <Dialog> (or <Sheet>)');
  return ctx;
};

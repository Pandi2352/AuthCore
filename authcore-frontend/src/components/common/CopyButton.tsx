import { Check, Copy } from 'lucide-react';

import { IconButton, toast } from '@/components/ui';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';

export interface CopyButtonProps {
  value: string;
  /** Accessible name / tooltip. */
  label?: string;
  size?: 'sm' | 'md';
  /** Toast after copying (default: false — the icon change + live text are enough). */
  notify?: boolean;
  className?: string;
}

/** Copies `value`; the icon turns into a check and "Copied" is announced. */
export function CopyButton({
  value,
  label = 'Copy',
  size = 'md',
  notify = false,
  className,
}: CopyButtonProps) {
  const { copy, copied } = useCopyToClipboard();
  return (
    <>
      <IconButton
        aria-label={copied ? 'Copied' : label}
        size={size}
        className={className}
        icon={copied ? <Check className="text-success" /> : <Copy />}
        onClick={async () => {
          const ok = await copy(value);
          if (!ok) toast.error('Could not copy to the clipboard');
          else if (notify) toast.success('Copied to the clipboard');
        }}
      />
      <span className="sr-only" aria-live="polite">
        {copied ? 'Copied' : ''}
      </span>
    </>
  );
}

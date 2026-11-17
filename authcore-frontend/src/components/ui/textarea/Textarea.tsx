import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
} from 'react';

import { useOptionalTheme } from '@/app/theme';
import { cn } from '@/lib/utils';

import { useFieldControlProps } from '../field';
import { controlVariants, type ControlVariant } from '../input';
import { composeRefs } from '../primitives/compose';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: ControlVariant;
  invalid?: boolean;
  /** Grow with the content (between `rows` and `maxRows`). */
  autoResize?: boolean;
  maxRows?: number;
  /** Show "12 / 500" under the field when maxLength is set. */
  showCount?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    variant,
    invalid,
    autoResize = false,
    maxRows = 12,
    rows = 3,
    showCount = false,
    className,
    onChange,
    ...props
  },
  ref,
) {
  const theme = useOptionalTheme();
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  const { invalid: _invalid, ...a11y } = useFieldControlProps({ ...props, invalid });
  void _invalid;

  const resize = useCallback(() => {
    const el = innerRef.current;
    if (!el || !autoResize) return;
    const line = parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, line * maxRows + 16)}px`;
  }, [autoResize, maxRows]);

  useLayoutEffect(resize, [resize, props.value]);

  const length = typeof props.value === 'string' ? props.value.length : undefined;
  return (
    <div className="w-full">
      <textarea
        ref={composeRefs(ref, innerRef)}
        rows={rows}
        onChange={(event) => {
          onChange?.(event);
          resize();
        }}
        className={cn(
          controlVariants({ variant: variant ?? theme?.appearance.inputs ?? 'outlined' }),
          'h-auto min-h-control-md py-2 leading-relaxed',
          autoResize ? 'resize-none overflow-y-auto' : 'resize-y',
          className,
        )}
        {...props}
        {...a11y}
      />
      {showCount && props.maxLength !== undefined && length !== undefined && (
        <p className="mt-1 text-right text-xs text-muted-foreground" aria-live="polite">
          {length} / {props.maxLength}
        </p>
      )}
    </div>
  );
});

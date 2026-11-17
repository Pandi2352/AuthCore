import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
} from 'react';

import { useOptionalTheme } from '@/app/theme';
import { cn } from '@/lib/utils';

import { FieldShell, resolveInvalid, useFieldControlProps, type FieldShellProps } from '../field';
import { controlVariants, type ControlVariant } from '../input';
import { composeRefs } from '../primitives/compose';

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldShellProps {
  variant?: ControlVariant;
  /** Force the invalid look (normally derived from `error`). */
  invalid?: boolean;
  /** Grow with the content (between `rows` and `maxRows`). */
  autoResize?: boolean;
  maxRows?: number;
  /** Show "12 / 500" under the field when maxLength is set. */
  showCount?: boolean;
}

type BareTextareaProps = Omit<TextareaProps, 'label' | 'hint' | 'error' | 'fieldClassName'>;

const BareTextarea = forwardRef<HTMLTextAreaElement, BareTextareaProps>(function BareTextarea(
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
  const atLimit =
    props.maxLength !== undefined && length !== undefined && length >= props.maxLength;
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
        <p
          className={cn(
            'mt-1 text-right text-xs tabular-nums',
            atLimit ? 'font-medium text-danger' : 'text-muted-foreground',
          )}
          aria-live="polite"
        >
          {length} / {props.maxLength}
        </p>
      )}
    </div>
  );
});

/**
 * Multi-line text. Pass label / hint / error / required from the parent for a complete
 * field; every native textarea prop and event goes to the <textarea>.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, fieldClassName, invalid, ...props },
  ref,
) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={props.required}
      disabled={props.disabled}
      id={props.id}
      fieldClassName={fieldClassName}
    >
      <BareTextarea ref={ref} invalid={resolveInvalid(invalid, error)} {...props} />
    </FieldShell>
  );
});

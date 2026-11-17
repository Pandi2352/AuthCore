import { cn } from './cn';

/**
 * Tiny class-variance helper (our own, no dependency):
 *
 *   const button = variants({
 *     base: 'inline-flex …',
 *     variants: { size: { sm: 'h-8', md: 'h-10' }, variant: { solid: '…', ghost: '…' } },
 *     defaultVariants: { size: 'md', variant: 'solid' },
 *     compoundVariants: [{ variant: 'ghost', size: 'sm', className: '…' }],
 *   });
 *   button({ size: 'sm', className })
 */
type VariantMap = Record<string, Record<string, string>>;

type VariantSelection<V extends VariantMap> = { [K in keyof V]?: keyof V[K] | null };

interface VariantsConfig<V extends VariantMap> {
  base?: string;
  variants: V;
  defaultVariants?: VariantSelection<V>;
  compoundVariants?: Array<VariantSelection<V> & { className: string }>;
}

export type VariantProps<F> = F extends (props?: infer P) => string
  ? Omit<NonNullable<P>, 'className'>
  : never;

export function variants<V extends VariantMap>(config: VariantsConfig<V>) {
  return (props?: VariantSelection<V> & { className?: string }): string => {
    const selected: Record<string, unknown> = { ...config.defaultVariants };
    for (const [key, value] of Object.entries(props ?? {})) {
      if (key !== 'className' && value !== undefined && value !== null) selected[key] = value;
    }
    const classes: string[] = [config.base ?? ''];
    for (const [key, options] of Object.entries(config.variants)) {
      const value = selected[key];
      if (typeof value === 'string' && options[value]) classes.push(options[value]);
    }
    for (const compound of config.compoundVariants ?? []) {
      const { className, ...conditions } = compound;
      if (Object.entries(conditions).every(([key, value]) => selected[key] === value)) {
        classes.push(className);
      }
    }
    return cn(...classes, props?.className);
  };
}

import { forwardRef, type ReactNode } from 'react';

import { Button, type ButtonProps } from '../button';
import { Tooltip } from '../tooltip';

export interface IconButtonProps extends Omit<
  ButtonProps,
  'leftIcon' | 'rightIcon' | 'children' | 'size'
> {
  /** Required: icon-only buttons need an accessible name. Also shown as a tooltip. */
  'aria-label': string;
  icon: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Show the label as a tooltip on hover / focus (default true). */
  showTooltip?: boolean;
}

const SIZE = { sm: 'icon-sm', md: 'icon', lg: 'icon-lg' } as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, size = 'md', variant = 'ghost', showTooltip = true, ...props },
  ref,
) {
  const button = (
    <Button ref={ref} size={SIZE[size]} variant={variant} {...props}>
      {icon}
    </Button>
  );
  return showTooltip ? <Tooltip content={props['aria-label']}>{button}</Tooltip> : button;
});

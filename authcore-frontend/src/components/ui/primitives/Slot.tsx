import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';

import { composeRefs, mergeProps } from './compose';

/**
 * `asChild` support: renders its single child element with our props merged in
 * (handlers chained, classes merged, refs composed). E.g. a Button rendered as a router Link:
 *   <Button asChild><Link to="/x">Go</Link></Button>
 */
export const Slot = forwardRef<HTMLElement, HTMLAttributes<HTMLElement> & { children?: ReactNode }>(
  function Slot({ children, ...props }, ref) {
    const child = Children.only(children);
    if (!isValidElement<Record<string, unknown>>(child)) return null;
    const childRef = (child.props as { ref?: Ref<HTMLElement> }).ref;
    return cloneElement(child, {
      ...mergeProps(props as Record<string, unknown>, child.props),
      ref: composeRefs(ref, childRef),
    } as Record<string, unknown>);
  },
);

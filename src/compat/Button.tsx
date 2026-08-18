"use client";
import * as React from 'react';
import { Button as CanonicalButton, buttonVariants } from '../components/ui/Button';

export { buttonVariants };
export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | null;
  size?: 'sm' | 'md' | 'lg' | null;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, ...props }, ref
) {
  const mapped = variant === 'outline' ? 'secondary' : variant;
  return <CanonicalButton ref={ref} {...(props as any)} variant={mapped as any} />;
});

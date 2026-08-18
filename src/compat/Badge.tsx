import * as React from 'react';
import { Badge as CanonicalBadge, badgeVariants } from '../components/ui/Badge';

export { badgeVariants };
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'default' | null;
}
export function Badge({ variant, ...props }: BadgeProps) {
  return <CanonicalBadge {...props} variant={(variant === 'default' ? 'neutral' : variant) as any} />;
}

import React from 'react';
import { cn } from '@/lib/utils';
import './Badge.css';

const Badge = React.forwardRef(({ className, variant = "filled", ...props }, ref) => {
  const variantClass = {
    filled: 'md3-badge-filled',
    outlined: 'md3-badge-outlined',
    tonal: 'md3-badge-tonal',
  }[variant] || 'md3-badge-filled';
  
  return (
    <span
      ref={ref}
      className={cn('md3-badge', variantClass, className)}
      {...props}
    />
  );
});
Badge.displayName = "Badge";

export { Badge };


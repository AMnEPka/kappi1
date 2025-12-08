import React from 'react';
import { cn } from '@/lib/utils';
import './Label.css';

const Label = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <label
      ref={ref}
      className={cn('md3-label', className)}
      {...props}
    />
  );
});
Label.displayName = "Label";

export { Label };


import React from 'react';
import { cn } from '@/lib/utils';
import './Input.css';

const Input = React.forwardRef(({ className, type = "text", error, ...props }, ref) => {
  return (
    <div className="md3-input-wrapper">
      <input
        type={type}
        className={cn('md3-input', error && 'md3-input-error', className)}
        ref={ref}
        {...props}
      />
      {error && (
        <span className="md3-input-error-text">{error}</span>
      )}
    </div>
  );
});
Input.displayName = "Input";

export { Input };


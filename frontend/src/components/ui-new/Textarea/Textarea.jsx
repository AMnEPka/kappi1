import React from 'react';
import { cn } from '@/lib/utils';
import './Textarea.css';

const Textarea = React.forwardRef(({ className, error, ...props }, ref) => {
  return (
    <div className="md3-textarea-wrapper">
      <textarea
        className={cn('md3-textarea', error && 'md3-textarea-error', className)}
        ref={ref}
        {...props}
      />
      {error && (
        <span className="md3-textarea-error-text">{error}</span>
      )}
    </div>
  );
});
Textarea.displayName = "Textarea";

export { Textarea };


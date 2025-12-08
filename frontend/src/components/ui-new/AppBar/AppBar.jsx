import React from 'react';
import { cn } from '@/lib/utils';
import './AppBar.css';

const AppBar = React.forwardRef(({ className, children, ...props }, ref) => {
  return (
    <header
      ref={ref}
      className={cn('md3-app-bar', className)}
      {...props}
    >
      {children}
    </header>
  );
});
AppBar.displayName = 'AppBar';

const AppBarContent = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('md3-app-bar-content', className)}
      {...props}
    />
  );
});
AppBarContent.displayName = 'AppBarContent';

export { AppBar, AppBarContent };


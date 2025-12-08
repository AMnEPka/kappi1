import React from 'react';
import { cn } from '@/lib/utils';
import './Sidebar.css';

const Sidebar = React.forwardRef(({ className, expanded = true, children, ...props }, ref) => {
  return (
    <nav
      ref={ref}
      className={cn('md3-sidebar', expanded ? 'md3-sidebar-expanded' : 'md3-sidebar-collapsed', className)}
      {...props}
    >
      {children}
    </nav>
  );
});
Sidebar.displayName = 'Sidebar';

const SidebarContent = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('md3-sidebar-content', className)}
      {...props}
    />
  );
});
SidebarContent.displayName = 'SidebarContent';

const SidebarItem = React.forwardRef(({ className, active, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('md3-sidebar-item', active && 'md3-sidebar-item-active', className)}
      {...props}
    />
  );
});
SidebarItem.displayName = 'SidebarItem';

export { Sidebar, SidebarContent, SidebarItem };


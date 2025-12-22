/**
 * Material Design 3 Components
 * 
 * Компоненты в стиле Material Design 3 для использования в layout и основных интерфейсах.
 * Используют CSS переменные из styles/material3.css
 * 
 * Использование:
 *   import { Button, AppBar, Sidebar } from '@/components/ui/md3';
 */

import React from 'react';
import { Slot } from "@radix-ui/react-slot";
import { cn } from '@/lib/utils';

// Import styles
import './md3-button.css';
import './md3-components.css';

// ============================================
// Button
// ============================================
const Button = React.forwardRef(({ 
  className, 
  variant = "filled", 
  size = "md", 
  asChild = false, 
  ...props 
}, ref) => {
  const Comp = asChild ? Slot : "button";
  
  const variantClass = {
    filled: 'md3-button-filled',
    outlined: 'md3-button-outlined',
    text: 'md3-button-text',
    elevated: 'md3-button-elevated',
    tonal: 'md3-button-tonal',
    ghost: 'md3-button-text',
    default: 'md3-button-filled',
  }[variant] || 'md3-button-filled';
  
  const sizeClass = {
    sm: 'md3-button-sm',
    md: 'md3-button-md',
    lg: 'md3-button-lg',
    icon: 'md3-button-icon',
    'icon-sm': 'md3-button-icon-sm',
    default: 'md3-button-md',
  }[size] || 'md3-button-md';
  
  return (
    <Comp
      className={cn('md3-button', variantClass, sizeClass, className)}
      ref={ref}
      {...props} 
    />
  );
});
Button.displayName = "Button";

// ============================================
// AppBar
// ============================================
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

// ============================================
// Sidebar
// ============================================
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

// ============================================
// Card
// ============================================
const Card = React.forwardRef(({ className, elevation = 1, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('md3-card', `md3-elevation-${elevation}`, className)}
      {...props}
    />
  );
});
Card.displayName = 'Card';

const CardHeader = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('md3-card-header', className)}
      {...props}
    />
  );
});
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <h3
      ref={ref}
      className={cn('md3-card-title', className)}
      {...props}
    />
  );
});
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn('md3-card-description', className)}
      {...props}
    />
  );
});
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('md3-card-content', className)}
      {...props}
    />
  );
});
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('md3-card-footer', className)}
      {...props}
    />
  );
});
CardFooter.displayName = 'CardFooter';

// ============================================
// Input
// ============================================
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

// ============================================
// Textarea
// ============================================
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

// ============================================
// Label
// ============================================
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

// ============================================
// Badge
// ============================================
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

// ============================================
// Exports
// ============================================
export {
  Button,
  AppBar,
  AppBarContent,
  Sidebar,
  SidebarContent,
  SidebarItem,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Textarea,
  Label,
  Badge
};


import React from 'react';
import { Slot } from "@radix-ui/react-slot";
import { cn } from '@/lib/utils';
import './Button.css';

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
    ghost: 'md3-button-text', // Alias for text
    default: 'md3-button-filled', // Alias for filled
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

export { Button };
import React from 'react';
import { Slot } from "@radix-ui/react-slot";
import { useButtonStyles } from './Button.css';

const Button = React.forwardRef(({ 
  className, 
  variant = "default", 
  size = "default", 
  asChild = false, 
  ...props 
}, ref) => {
  const styles = useButtonStyles();
  const Comp = asChild ? Slot : "button";
  
  return (
    <Comp
      className={`${styles.base} ${styles.variants[variant]} ${styles.sizes[size]} ${className || ''}`}
      ref={ref}
      {...props} 
    />
  );
});

Button.displayName = "ButtonNew";

export { Button };
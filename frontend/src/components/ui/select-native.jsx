// components/ui/select-native.jsx
import * as React from "react";
import { cn } from "@/lib/utils";

const SelectNative = React.forwardRef(({ className, children, ...props }, ref) => (
  <div className="relative w-full">
    <select
      ref={ref}
      className={cn(
        "w-full h-10 appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </select>
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
      <svg
        className="h-4 w-4 opacity-50"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </div>
  </div>
));

export { SelectNative };
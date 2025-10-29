import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { Toaster } from "@/components/ui/sonner";

// Suppress ResizeObserver errors (known Radix UI issue)
// More aggressive approach to catch all ResizeObserver errors
window.addEventListener('error', e => {
  if (e.message === 'ResizeObserver loop completed with undelivered notifications.' || 
      e.message === 'ResizeObserver loop limit exceeded') {
    e.stopImmediatePropagation();
    e.preventDefault();
    return true;
  }
}, true); // Use capture phase

// Additional safety net - override console.error temporarily
const _consoleError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('ResizeObserver loop') || 
     args[0].includes('ResizeObserver loop completed'))
  ) {
    return; // Suppress ResizeObserver errors in console
  }
  _consoleError.apply(console, args);
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
    <Toaster />
  </React.StrictMode>,
);

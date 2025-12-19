import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
// Import Material Design 3 component CSS files
import "@/components/ui/md3/md3-button.css";
import "@/components/ui/md3/md3-components.css";
import "@/components/layouts/MainLayout.css";
import App from "@/App";
import { Toaster } from "@/components/ui/sonner";

// ============================================
// Comprehensive ResizeObserver error suppression
// ============================================

// Method 1: Error event listener with capture
window.addEventListener('error', e => {
  if (e.message && (
    e.message.includes('ResizeObserver loop') ||
    e.message === 'ResizeObserver loop completed with undelivered notifications.' ||
    e.message === 'ResizeObserver loop limit exceeded'
  )) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return false;
  }
}, true);

// Method 2: Override console.error
const originalConsoleError = console.error;
console.error = function(...args) {
  const firstArg = args[0];
  if (
    typeof firstArg === 'string' &&
    (firstArg.includes('ResizeObserver loop') ||
     firstArg.includes('ResizeObserver loop completed'))
  ) {
    return; // Suppress
  }
  originalConsoleError.apply(console, args);
};

// Method 3: Wrap ResizeObserver constructor
if (typeof window !== 'undefined' && window.ResizeObserver) {
  const OriginalResizeObserver = window.ResizeObserver;
  
  window.ResizeObserver = class extends OriginalResizeObserver {
    constructor(callback) {
      super((entries, observer) => {
        window.requestAnimationFrame(() => {
          try {
            callback(entries, observer);
          } catch (e) {
            // Suppress ResizeObserver errors
            if (!e.message.includes('ResizeObserver loop')) {
              throw e;
            }
          }
        });
      });
    }
  };
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <>
    <App />
    <Toaster />
  </>,
);

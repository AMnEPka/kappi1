import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { Toaster } from "@/components/ui/sonner";

// Suppress ResizeObserver errors (known issue with Radix UI)
// This doesn't affect functionality, just removes console noise
const resizeObserverErrHandler = (e) => {
  if (e.message === 'ResizeObserver loop completed with undelivered notifications.' ||
      e.message === 'ResizeObserver loop limit exceeded') {
    const resizeObserverErr = e;
    if (resizeObserverErr) {
      e.stopImmediatePropagation();
    }
  }
};

window.addEventListener('error', resizeObserverErrHandler);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
    <Toaster />
  </React.StrictMode>,
);

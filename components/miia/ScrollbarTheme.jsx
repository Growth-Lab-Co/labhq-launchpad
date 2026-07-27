"use client";
import { useEffect } from "react";

// Adds the brand-violet scrollbar class to <html> only while a Miia page is
// mounted, and removes it on unmount — keeps the app shell's own scrollbar
// untouched when navigating to /portal, /admin, tenant routes, etc.
export function ScrollbarTheme() {
  useEffect(() => {
    document.documentElement.classList.add("miia-scrollbar");
    return () => document.documentElement.classList.remove("miia-scrollbar");
  }, []);
  return null;
}

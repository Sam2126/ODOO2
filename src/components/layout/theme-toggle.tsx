"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "stocksense-theme";

/**
 * Which icon shows is decided by CSS from the `dark` class on <html>, not by
 * React state. That avoids mirroring the DOM into state (and the hydration
 * mismatch that comes with it) for a value CSS can already see.
 */
export function ThemeToggle() {
  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Private browsing — the choice simply will not persist.
    }
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} title="Switch between light and dark">
      <Moon className="dark:hidden" aria-hidden />
      <Sun className="hidden dark:block" aria-hidden />
      <span className="sr-only">Switch between light and dark</span>
    </Button>
  );
}

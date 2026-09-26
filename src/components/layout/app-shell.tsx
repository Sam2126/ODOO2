"use client";

import type { Role } from "@prisma/client";
import { Boxes, LogOut, Menu, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { navFor } from "@/config/nav";
import { cn } from "@/lib/utils";

type AppShellProps = {
  user: { name: string; email: string; role: Role };
  lowStockCount: number;
  logoutAction: () => Promise<void>;
  children: ReactNode;
};

export function AppShell({ user, lowStockCount, logoutAction, children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const groups = navFor(user.role);

  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const nav = (
    <nav className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div key={group.group}>
          <p className="px-3 pb-1.5 text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase">
            {group.group}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    // Navigating on a phone should close the drawer behind you.
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent-subtle text-accent shadow-[inset_2px_0_0_var(--accent)]"
                        : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Boxes className="size-4" aria-hidden />
      </span>
      <span className="font-display text-xl leading-none">StockSense</span>
    </div>
  );

  const account = (
    <div className="border-t border-border p-3">
      <Link
        href="/profile"
        className="flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-surface-muted"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-muted-foreground ring-1 ring-border">
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {user.role === "MANAGER" ? "Inventory Manager" : "Warehouse Staff"}
          </span>
        </span>
      </Link>
      <form action={logoutAction}>
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="mt-1 w-full justify-start px-2"
        >
          <LogOut aria-hidden />
          Log out
        </Button>
      </form>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
        {brand}
        {nav}
        {account}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/45"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border pr-2">
              <div className="flex-1">{brand}</div>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X aria-hidden />
                <span className="sr-only">Close navigation</span>
              </Button>
            </div>
            {nav}
            {account}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu aria-hidden />
            <span className="sr-only">Open navigation</span>
          </Button>

          <div className="flex-1" />

          {lowStockCount > 0 ? (
            <Link
              href="/products?stock=low"
              className="inline-flex items-center gap-1.5 rounded-full bg-warning-subtle px-3 py-1 text-xs font-medium text-warning ring-1 ring-warning/25 transition-opacity hover:opacity-85"
            >
              <TriangleAlert className="size-3.5" aria-hidden />
              {lowStockCount} need{lowStockCount === 1 ? "s" : ""} reordering
            </Link>
          ) : null}

          <ThemeToggle />
        </header>

        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10">
          <div className="mx-auto w-full max-w-7xl space-y-7">{children}</div>
        </main>
      </div>
    </div>
  );
}

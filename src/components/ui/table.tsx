import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Tables are the main way this app shows anything, so they get a scroll
 * container of their own: a wide document line list must not make the whole
 * page scroll sideways.
 */
export function TableShell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-surface",
        className,
      )}
    >
      <div className="scrollbar-thin overflow-x-auto">{children}</div>
    </div>
  );
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
  return (
    <thead
      className={cn("border-b border-border bg-surface-muted/60", className)}
      {...props}
    />
  );
}

export function TH({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

export function TBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}

export function TR({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("transition-colors hover:bg-surface-muted/50", className)} {...props} />;
}

export function TD({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-4 py-2.5 align-middle", className)} {...props} />;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}

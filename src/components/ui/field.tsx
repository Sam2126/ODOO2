import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

const controlBase =
  "w-full rounded-lg border bg-surface px-3.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-60";

const controlState = (invalid?: boolean) =>
  invalid ? "border-danger" : "border-border hover:border-border-strong";

export function Input({
  className,
  invalid,
  ...props
}: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(controlBase, controlState(invalid), "h-10", className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(controlBase, controlState(invalid), "min-h-20 py-2 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  invalid,
  ...props
}: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(controlBase, controlState(invalid), "h-10 pr-8", className)}
      {...props}
    />
  );
}

type FieldProps = {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Label, control and message as one unit. The message slot always renders so
 * that a row of fields does not shift downward when one becomes invalid.
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>
      {children}
      <p
        className={cn(
          "min-h-4 text-xs leading-4",
          error ? "text-danger" : "text-muted-foreground",
        )}
      >
        {error ?? hint ?? ""}
      </p>
    </div>
  );
}

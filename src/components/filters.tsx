"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/**
 * Keeps filters in the URL so filtered views can be linked, bookmarked,
 * reloaded, and restored through dashboard deep links.
 */
function useFilterNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const apply = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }

    const query = params.toString();
    const destination = query ? `${pathname}?${query}` : pathname;

    startTransition(() => {
      router.replace(destination);
    });
  };

  return { apply, isPending, searchParams };
}

export type FilterOption = {
  value: string;
  label: string;
};

export function FilterSelect({
  name,
  label,
  options,
  allLabel = "All",
  className,
}: {
  name: string;
  label: string;
  options: FilterOption[];
  allLabel?: string;
  className?: string;
}) {
  const { apply, searchParams, isPending } = useFilterNavigation();
  const value = searchParams.get(name) ?? "";

  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>

      <Select
        value={value}
        disabled={isPending}
        onChange={(event) => apply(name, event.target.value)}
        className="h-9 text-[0.8125rem]"
      >
        <option value="">{allLabel}</option>

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

export function SearchInput({
  name = "q",
  placeholder = "Search…",
  label = "Search",
  className,
}: {
  name?: string;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  const { apply, searchParams } = useFilterNavigation();
  const urlValue = searchParams.get(name) ?? "";

  const [value, setValue] = useState(urlValue);
  const [syncedFrom, setSyncedFrom] = useState(urlValue);

  // Keep local input state in sync when the URL changes externally,
  // such as through Clear links or dashboard deep links.
  if (urlValue !== syncedFrom) {
    setSyncedFrom(urlValue);
    setValue(urlValue);
  }

  // Debounce search navigation so typing does not trigger a navigation
  // for every individual character.
  useEffect(() => {
    const trimmedValue = value.trim();

    if (trimmedValue === urlValue) {
      return;
    }

    const timer = setTimeout(() => {
      apply(name, trimmedValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [apply, name, urlValue, value]);

  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>

      <span className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />

        <input
          type="search"
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          className="h-9 w-full rounded-lg border border-border bg-surface pr-3 pl-8 text-[0.8125rem] text-foreground placeholder:text-muted-foreground/60 hover:border-border-strong"
          aria-label={label}
        />
      </span>
    </label>
  );
}

export function DateFilter({
  name,
  label,
  className,
}: {
  name: string;
  label: string;
  className?: string;
}) {
  const { apply, searchParams } = useFilterNavigation();
  const value = searchParams.get(name) ?? "";

  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>

      <input
        type="date"
        value={value}
        onChange={(event) => apply(name, event.target.value)}
        className="h-9 rounded-lg border border-border bg-surface px-2.5 text-[0.8125rem] text-foreground hover:border-border-strong"
        aria-label={label}
      />
    </label>
  );
}

export function FilterBar({
  children,
  activeCount,
  basePath,
}: {
  children: React.ReactNode;
  activeCount: number;
  basePath: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
      {children}

      {activeCount > 0 ? (
        <Link
          href={basePath}
          className="mb-0.5 inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[0.8125rem] font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden="true" />
          Clear {activeCount}
        </Link>
      ) : null}
    </div>
  );
}

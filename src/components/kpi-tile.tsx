import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Tone = "neutral" | "primary" | "warning" | "danger" | "success";

const TONE_RING: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted-foreground",
  primary: "bg-primary-subtle text-primary",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  success: "bg-success-subtle text-success",
};

export function KpiTile({
  label,
  value,
  caption,
  icon: Icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: string | number;
  caption?: string;
  icon: LucideIcon;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        <span className={cn("flex size-7 items-center justify-center rounded-md", TONE_RING[tone])}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="tabular mt-3 text-3xl leading-none font-semibold tracking-tight">{value}</p>
      {caption ? <p className="mt-1.5 text-xs text-muted-foreground">{caption}</p> : null}
    </>
  );

  const className =
    "block rounded-lg border border-border bg-surface px-4 py-3.5 transition-colors";

  return href ? (
    <Link href={href} className={cn(className, "hover:border-border-strong hover:bg-surface-muted/40")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

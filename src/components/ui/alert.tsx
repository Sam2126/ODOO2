import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const TONES = {
  error: {
    icon: AlertTriangle,
    className: "border-danger/30 bg-danger-subtle text-danger",
  },
  success: {
    icon: CheckCircle2,
    className: "border-success/30 bg-success-subtle text-success",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-warning/30 bg-warning-subtle text-warning",
  },
  info: {
    icon: Info,
    className: "border-primary/25 bg-accent-subtle text-accent",
  },
} as const;

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
  className?: string;
}) {
  const { icon: Icon, className: toneClass } = TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm",
        toneClass,
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 [&_a]:underline">{children}</div>
    </div>
  );
}

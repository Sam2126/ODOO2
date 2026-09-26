import type { DocStatus } from "@prisma/client";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import type { StockLevel } from "@/lib/stock";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-surface-muted text-muted-foreground ring-1 ring-border",
        primary: "bg-primary-subtle text-primary ring-1 ring-primary/25",
        success: "bg-success-subtle text-success ring-1 ring-success/25",
        warning: "bg-warning-subtle text-warning ring-1 ring-warning/25",
        danger: "bg-danger-subtle text-danger ring-1 ring-danger/25",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

const STATUS_TONE: Record<DocStatus, BadgeTone> = {
  DRAFT: "neutral",
  WAITING: "warning",
  READY: "primary",
  DONE: "success",
  CANCELED: "danger",
};

const STATUS_LABEL: Record<DocStatus, string> = {
  DRAFT: "Draft",
  WAITING: "Waiting",
  READY: "Ready",
  DONE: "Done",
  CANCELED: "Canceled",
};

export function StatusBadge({ status }: { status: DocStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export const statusLabel = (status: DocStatus) => STATUS_LABEL[status];

const STOCK_TONE: Record<StockLevel, BadgeTone> = {
  OUT_OF_STOCK: "danger",
  LOW_STOCK: "warning",
  IN_STOCK: "success",
};

const STOCK_LABEL: Record<StockLevel, string> = {
  OUT_OF_STOCK: "Out of stock",
  LOW_STOCK: "Low stock",
  IN_STOCK: "In stock",
};

export function StockBadge({ level }: { level: StockLevel }) {
  return <Badge tone={STOCK_TONE[level]}>{STOCK_LABEL[level]}</Badge>;
}

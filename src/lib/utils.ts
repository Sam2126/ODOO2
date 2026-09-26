import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { Uom } from "@prisma/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const UOM_LABEL: Record<Uom, string> = {
  UNIT: "Units",
  KG: "kg",
  LITRE: "L",
  METRE: "m",
  BOX: "Boxes",
  PACK: "Packs",
};

export const uomLabel = (uom: Uom) => UOM_LABEL[uom];

/**
 * Quantities are stored with three decimal places but are usually whole
 * numbers. Trailing zeroes are noise on a stock list, so they are dropped.
 */
export function formatQty(value: number, uom?: Uom) {
  const text = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value);
  return uom ? `${text} ${uomLabel(uom)}` : text;
}

export function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/** `2026-09-26` — the value shape an `<input type="date">` expects. */
export function toDateInputValue(value: Date | string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

/** Builds a querystring from the current params plus an overriding patch. */
export function buildQuery(
  current: Record<string, string | undefined>,
  patch: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...patch })) {
    if (value !== undefined && value !== "" && value !== "all") params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

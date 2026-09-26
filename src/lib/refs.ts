import "server-only";

import { PickingType } from "@prisma/client";

import type { Tx } from "@/lib/stock";

/**
 * Human-readable document references, Odoo style: WH/IN/00001.
 *
 * The counter lives in its own table and is incremented with a single atomic
 * upsert inside the caller's transaction. Deriving the number from a row count
 * instead would hand the same reference to two people validating at once —
 * which, during a live demo, is exactly when it would happen.
 */
export async function nextReference(tx: Tx, prefix: string) {
  const sequence = await tx.documentSequence.upsert({
    where: { prefix },
    create: { prefix, next: 2 },
    update: { next: { increment: 1 } },
    select: { next: true },
  });

  // `next` now points at the following document, so this one takes next - 1.
  const serial = sequence.next - 1;
  return `${prefix}/${String(serial).padStart(5, "0")}`;
}

const PICKING_SEGMENT: Record<PickingType, string> = {
  [PickingType.RECEIPT]: "IN",
  [PickingType.DELIVERY]: "OUT",
  [PickingType.INTERNAL]: "INT",
};

export const pickingPrefix = (type: PickingType, warehouseCode: string) =>
  `${warehouseCode}/${PICKING_SEGMENT[type]}`;

export const ADJUSTMENT_PREFIX = "ADJ";

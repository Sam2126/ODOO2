import "server-only";

import { PickingType } from "@prisma/client";

import type { Tx } from "@/lib/stock";

const SERIAL_DIGITS = 5;

const format = (prefix: string, serial: number) =>
  `${prefix}/${String(serial).padStart(SERIAL_DIGITS, "0")}`;

/**
 * Human-readable document references, Odoo style: WH/IN/00001.
 *
 * The counter lives in its own table and is incremented with a single atomic
 * upsert inside the caller's transaction. Deriving the number from a row count
 * instead would hand the same reference to two people validating at once —
 * which, during a live demo, is exactly when it would happen.
 *
 * The counter can still fall behind the documents themselves: restoring a
 * database dump, or seeding on top of existing rows, leaves references in place
 * while the counter starts again at one. That used to surface as an opaque
 * unique-constraint error on the first validation afterwards, so the counter is
 * now seeded from the highest reference already in use, and a collision is
 * retried rather than thrown.
 */
export async function nextReference(tx: Tx, prefix: string) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const sequence = await tx.documentSequence.upsert({
      where: { prefix },
      create: { prefix, next: (await highestSerialInUse(tx, prefix)) + 2 },
      update: { next: { increment: 1 } },
      select: { next: true },
    });

    // `next` now points at the following document, so this one takes next - 1.
    const reference = format(prefix, sequence.next - 1);
    if (!(await referenceTaken(tx, reference))) return reference;
    // Taken: the counter was behind. Loop, which bumps it again.
  }

  throw new Error(
    `Could not allocate a free reference for "${prefix}" after 25 attempts.`,
  );
}

/** The largest serial already used by a document with this prefix, or 0. */
async function highestSerialInUse(tx: Tx, prefix: string) {
  const [picking, adjustment] = await Promise.all([
    tx.picking.findFirst({
      where: { reference: { startsWith: `${prefix}/` } },
      orderBy: { reference: "desc" },
      select: { reference: true },
    }),
    tx.adjustment.findFirst({
      where: { reference: { startsWith: `${prefix}/` } },
      orderBy: { reference: "desc" },
      select: { reference: true },
    }),
  ]);

  const serials = [picking?.reference, adjustment?.reference]
    .filter((reference): reference is string => Boolean(reference))
    .map((reference) => Number.parseInt(reference.slice(prefix.length + 1), 10))
    .filter((serial) => Number.isFinite(serial));

  return serials.length > 0 ? Math.max(...serials) : 0;
}

async function referenceTaken(tx: Tx, reference: string) {
  const [picking, adjustment] = await Promise.all([
    tx.picking.findUnique({ where: { reference }, select: { id: true } }),
    tx.adjustment.findUnique({ where: { reference }, select: { id: true } }),
  ]);
  return Boolean(picking ?? adjustment);
}

const PICKING_SEGMENT: Record<PickingType, string> = {
  [PickingType.RECEIPT]: "IN",
  [PickingType.DELIVERY]: "OUT",
  [PickingType.INTERNAL]: "INT",
};

export const pickingPrefix = (type: PickingType, warehouseCode: string) =>
  `${warehouseCode}/${PICKING_SEGMENT[type]}`;

export const ADJUSTMENT_PREFIX = "ADJ";

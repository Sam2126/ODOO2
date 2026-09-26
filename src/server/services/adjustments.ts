import "server-only";

import { DocStatus, LocationType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { StockError } from "@/lib/errors";
import { ADJUSTMENT_PREFIX, nextReference } from "@/lib/refs";
import { applyMove, onHandAt, virtualLocationId, VIRTUAL_LOCATION } from "@/lib/stock";

/** The physical-count use cases, kept free of request concerns. */

export type AdjustmentLineInput = { productId: string; countedQty: number };

export function assertAdjustmentEditable(status: DocStatus) {
  if (status === DocStatus.DONE) {
    throw new StockError("This count is already applied and cannot be changed.");
  }
  if (status === DocStatus.CANCELED) {
    throw new StockError("This count is canceled. Reset it to draft before editing.");
  }
}

export async function assertCountableLocation(locationId: string) {
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: { type: true, name: true },
  });
  if (!location) throw new StockError("Choose a valid location.");
  if (location.type !== LocationType.INTERNAL) {
    throw new StockError(`${location.name} is a virtual location and holds no physical stock.`);
  }
}

export function createAdjustment(
  userId: string,
  input: { locationId: string; note?: string },
  lines: AdjustmentLineInput[],
) {
  return prisma.$transaction(async (tx) =>
    tx.adjustment.create({
      data: {
        reference: await nextReference(tx, ADJUSTMENT_PREFIX),
        locationId: input.locationId,
        note: input.note,
        createdById: userId,
        lines: {
          create: lines.map((line) => ({
            productId: line.productId,
            countedQty: new Prisma.Decimal(line.countedQty),
          })),
        },
      },
      select: { id: true, reference: true },
    }),
  );
}

export function updateAdjustment(
  id: string,
  input: { locationId: string; note?: string },
  lines: AdjustmentLineInput[],
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.adjustment.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
    assertAdjustmentEditable(existing.status);

    await tx.adjustmentLine.deleteMany({ where: { adjustmentId: id } });
    await tx.adjustment.update({
      where: { id },
      data: {
        locationId: input.locationId,
        note: input.note ?? null,
        lines: {
          create: lines.map((line) => ({
            productId: line.productId,
            countedQty: new Prisma.Decimal(line.countedQty),
          })),
        },
      },
    });
  });
}

/**
 * Applies the count.
 *
 * The system quantity is read at this moment and stored on the line, so the
 * document keeps a record of what it corrected even though the live quantity
 * moves on afterwards. Surpluses come out of the adjustment location and
 * shortages go back into it, which is what keeps the ledger balanced.
 */
export function validateAdjustment(userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const adjustment = await tx.adjustment.findUniqueOrThrow({
      where: { id },
      include: { lines: true },
    });

    if (adjustment.status === DocStatus.DONE) {
      throw new StockError("This count has already been applied.");
    }
    if (adjustment.status === DocStatus.CANCELED) {
      throw new StockError("A canceled count cannot be applied.");
    }
    if (adjustment.lines.length === 0) {
      throw new StockError("Add at least one product line before applying the count.");
    }

    const adjustmentLocationId = await virtualLocationId(tx, VIRTUAL_LOCATION.ADJUSTMENT);
    let corrected = 0;

    for (const line of adjustment.lines) {
      const systemQty = await onHandAt(tx, line.productId, adjustment.locationId);
      const difference = line.countedQty.minus(systemQty);

      await tx.adjustmentLine.update({ where: { id: line.id }, data: { systemQty } });

      if (difference.isZero()) continue;

      const surplus = difference.greaterThan(0);
      await applyMove(tx, {
        productId: line.productId,
        quantity: difference.abs(),
        sourceLocationId: surplus ? adjustmentLocationId : adjustment.locationId,
        destLocationId: surplus ? adjustment.locationId : adjustmentLocationId,
        reference: adjustment.reference,
        adjustmentId: adjustment.id,
        userId,
      });
      corrected += 1;
    }

    await tx.adjustment.update({
      where: { id },
      data: { status: DocStatus.DONE, validatedAt: new Date() },
    });

    return { reference: adjustment.reference, corrected };
  });
}

export async function cancelAdjustment(id: string) {
  const adjustment = await prisma.adjustment.findUniqueOrThrow({
    where: { id },
    select: { status: true },
  });
  if (adjustment.status === DocStatus.DONE) {
    throw new StockError("An applied count cannot be canceled. Record a new count instead.");
  }
  await prisma.adjustment.update({ where: { id }, data: { status: DocStatus.CANCELED } });
}

export async function resetAdjustmentToDraft(id: string) {
  const adjustment = await prisma.adjustment.findUniqueOrThrow({
    where: { id },
    select: { status: true },
  });
  if (adjustment.status === DocStatus.DONE) {
    throw new StockError("An applied count cannot be reopened.");
  }
  await prisma.adjustment.update({ where: { id }, data: { status: DocStatus.DRAFT } });
}

export async function deleteAdjustment(id: string) {
  const adjustment = await prisma.adjustment.findUniqueOrThrow({
    where: { id },
    select: { status: true },
  });
  if (adjustment.status === DocStatus.DONE) {
    throw new StockError("An applied count cannot be deleted.");
  }
  await prisma.adjustment.delete({ where: { id } });
}

/** Pre-fills a count sheet with whatever the system currently believes. */
export async function locationCountSheet(locationId: string) {
  const quants = await prisma.stockQuant.findMany({
    where: { locationId, product: { isActive: true } },
    include: { product: { select: { id: true, name: true, sku: true, uom: true } } },
    orderBy: { product: { name: "asc" } },
  });

  return quants.map((quant) => ({
    productId: quant.product.id,
    name: quant.product.name,
    sku: quant.product.sku,
    uom: quant.product.uom,
    systemQty: quant.quantity.toNumber(),
  }));
}

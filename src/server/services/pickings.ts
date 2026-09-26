import "server-only";

import { DocStatus, LocationType, PickingType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { StockError } from "@/lib/errors";
import { nextReference, pickingPrefix } from "@/lib/refs";
import { applyMove, onHandAt, type Tx } from "@/lib/stock";

/**
 * The receipt / delivery / internal-transfer use cases.
 *
 * These are separated from the server actions in `actions/pickings.ts` so the
 * rules live somewhere that does not depend on a request: the actions handle
 * authentication, parsing and cache invalidation, and everything here is plain
 * functions that can be called from a script or a test.
 */

export type PickingHeader = {
  type: PickingType;
  warehouseId: string;
  sourceLocationId: string;
  destLocationId: string;
  partnerName?: string;
  scheduledAt: Date;
  note?: string;
};

export type PickingLineInput = {
  productId: string;
  demandQty: number;
  doneQty?: number;
};

export function assertPickingEditable(status: DocStatus) {
  if (status === DocStatus.DONE) {
    throw new StockError("This document is validated. Validated documents cannot be changed.");
  }
  if (status === DocStatus.CANCELED) {
    throw new StockError("This document is canceled. Reset it to draft before editing.");
  }
}

/**
 * Locations must belong to the document's warehouse, or be the right kind of
 * virtual location. Without this a delivery could be pointed at another
 * warehouse's rack by editing the form's hidden values.
 */
export async function assertLocationsUsable(
  tx: Tx,
  type: PickingType,
  warehouseId: string,
  sourceLocationId: string,
  destLocationId: string,
) {
  if (sourceLocationId === destLocationId) {
    throw new StockError("Source and destination must be different locations.");
  }

  const locations = await tx.location.findMany({
    where: { id: { in: [sourceLocationId, destLocationId] } },
    select: { id: true, type: true, warehouseId: true, name: true },
  });

  if (locations.length !== 2) throw new StockError("Choose a valid source and destination.");

  const source = locations.find((location) => location.id === sourceLocationId)!;
  const destination = locations.find((location) => location.id === destLocationId)!;

  // A document belongs to the warehouse it moves stock *out of*, which is what
  // its reference is numbered from. Every real location on it must be in that
  // warehouse — except the destination of an internal transfer, because
  // "Warehouse 1 to Warehouse 2" is a transfer the problem statement asks for.
  const mayLeaveWarehouse = type === PickingType.INTERNAL;
  for (const location of locations) {
    if (location.type !== LocationType.INTERNAL) continue;
    if (location.id === destLocationId && mayLeaveWarehouse) continue;
    if (location.warehouseId !== warehouseId) {
      throw new StockError(`${location.name} does not belong to the selected warehouse.`);
    }
  }

  if (type === PickingType.RECEIPT && source.type !== LocationType.VENDOR) {
    throw new StockError("A receipt must come from the vendor location.");
  }
  if (type === PickingType.DELIVERY && destination.type !== LocationType.CUSTOMER) {
    throw new StockError("A delivery must go to the customer location.");
  }
  if (
    type === PickingType.INTERNAL &&
    (source.type !== LocationType.INTERNAL || destination.type !== LocationType.INTERNAL)
  ) {
    throw new StockError("An internal transfer moves stock between two real locations.");
  }
}

/**
 * The pickers only ever offer active products, so this guards the path a
 * tampered form or a script could take. An archived product already on a draft
 * has to be removed before the draft can be saved again, which is the point:
 * it should not be moved.
 */
export async function assertProductsActive(tx: Tx, productIds: string[]) {
  const archived = await tx.product.findMany({
    where: { id: { in: productIds }, isActive: false },
    select: { name: true, sku: true },
  });
  if (archived.length > 0) {
    const names = archived.map((p) => `${p.name} (${p.sku})`).join(", ");
    throw new StockError(
      `Archived and cannot be moved: ${names}. Restore the product or remove the line.`,
    );
  }
}

const lineData = (lines: PickingLineInput[]) =>
  lines.map((line) => ({
    productId: line.productId,
    demandQty: new Prisma.Decimal(line.demandQty),
    // Done mirrors demand until someone trims it for a partial movement.
    doneQty: new Prisma.Decimal(line.doneQty ?? line.demandQty),
  }));

export function createPicking(
  userId: string,
  header: PickingHeader,
  lines: PickingLineInput[],
) {
  return prisma.$transaction(async (tx) => {
    await assertLocationsUsable(
      tx,
      header.type,
      header.warehouseId,
      header.sourceLocationId,
      header.destLocationId,
    );

    await assertProductsActive(tx, lines.map((line) => line.productId));

    const warehouse = await tx.warehouse.findUniqueOrThrow({
      where: { id: header.warehouseId },
      select: { code: true },
    });

    return tx.picking.create({
      data: {
        reference: await nextReference(tx, pickingPrefix(header.type, warehouse.code)),
        type: header.type,
        warehouseId: header.warehouseId,
        sourceLocationId: header.sourceLocationId,
        destLocationId: header.destLocationId,
        partnerName: header.partnerName,
        scheduledAt: header.scheduledAt,
        note: header.note,
        createdById: userId,
        lines: { create: lineData(lines) },
      },
      select: { id: true, type: true, reference: true },
    });
  });
}

export function updatePicking(
  id: string,
  header: PickingHeader,
  lines: PickingLineInput[],
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.picking.findUniqueOrThrow({
      where: { id },
      select: { status: true, type: true },
    });
    assertPickingEditable(existing.status);

    await assertLocationsUsable(
      tx,
      existing.type,
      header.warehouseId,
      header.sourceLocationId,
      header.destLocationId,
    );

    await assertProductsActive(tx, lines.map((line) => line.productId));

    // Lines are replaced wholesale: the editor submits the full set, and an
    // unvalidated document has no history worth preserving.
    await tx.pickingLine.deleteMany({ where: { pickingId: id } });
    await tx.picking.update({
      where: { id },
      data: {
        warehouseId: header.warehouseId,
        sourceLocationId: header.sourceLocationId,
        destLocationId: header.destLocationId,
        partnerName: header.partnerName ?? null,
        scheduledAt: header.scheduledAt,
        note: header.note ?? null,
        lines: { create: lineData(lines) },
      },
    });

    return existing.type;
  });
}

/**
 * Compares what the document wants against what is actually on the shelf and
 * parks it at READY or WAITING. This is what gives those two statuses meaning
 * instead of leaving them as labels nobody sets.
 */
export function checkAvailability(id: string) {
  return prisma.$transaction(async (tx) => {
    const picking = await tx.picking.findUniqueOrThrow({
      where: { id },
      include: { lines: true, sourceLocation: { select: { type: true } } },
    });
    assertPickingEditable(picking.status);

    if (picking.lines.length === 0) {
      throw new StockError("Add at least one product line first.");
    }

    let ready = true;
    // A vendor location always supplies; only real locations can run out.
    if (picking.sourceLocation.type === LocationType.INTERNAL) {
      for (const line of picking.lines) {
        const wanted = line.doneQty.greaterThan(0) ? line.doneQty : line.demandQty;
        const available = await onHandAt(tx, line.productId, picking.sourceLocationId);
        if (available.lessThan(wanted)) {
          ready = false;
          break;
        }
      }
    }

    const status = ready ? DocStatus.READY : DocStatus.WAITING;
    await tx.picking.update({ where: { id }, data: { status } });
    return { status, type: picking.type };
  });
}

/**
 * Turns the document into stock movement.
 *
 * Everything happens in one transaction: if any line would take a real
 * location below zero, nothing is written at all and the document is left
 * exactly as it was.
 */
export function validatePicking(userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const picking = await tx.picking.findUniqueOrThrow({
      where: { id },
      include: { lines: true },
    });

    if (picking.status === DocStatus.DONE) {
      throw new StockError("This document has already been validated.");
    }
    if (picking.status === DocStatus.CANCELED) {
      throw new StockError("A canceled document cannot be validated.");
    }
    if (picking.lines.length === 0) {
      throw new StockError("Add at least one product line before validating.");
    }

    const moving = picking.lines.filter((line) => line.doneQty.greaterThan(0));
    if (moving.length === 0) {
      throw new StockError("Every line has a done quantity of zero — nothing would move.");
    }

    for (const line of moving) {
      await applyMove(tx, {
        productId: line.productId,
        quantity: line.doneQty,
        sourceLocationId: picking.sourceLocationId,
        destLocationId: picking.destLocationId,
        reference: picking.reference,
        pickingId: picking.id,
        userId,
      });
    }

    await tx.picking.update({
      where: { id },
      data: { status: DocStatus.DONE, validatedAt: new Date() },
    });

    return { reference: picking.reference, type: picking.type, moved: moving.length };
  });
}

/**
 * The two preparation steps a delivery goes through before it is validated:
 * items are picked off the shelf, then packed for despatch.
 *
 * Neither moves stock — that only happens at validation — so they are recorded
 * as timestamps rather than statuses. Marking a step is idempotent, and
 * packing implies picking, so a warehouse that does both at once can press one
 * button.
 */
export async function markPickingStage(id: string, stage: "picked" | "packed") {
  const picking = await prisma.picking.findUniqueOrThrow({
    where: { id },
    select: { status: true, type: true, pickedAt: true },
  });

  if (picking.type !== PickingType.DELIVERY) {
    throw new StockError("Picking and packing apply to delivery orders only.");
  }
  assertPickingEditable(picking.status);

  const now = new Date();
  await prisma.picking.update({
    where: { id },
    data:
      stage === "picked"
        ? { pickedAt: now }
        : { packedAt: now, pickedAt: picking.pickedAt ?? now },
  });

  return picking.type;
}

export async function cancelPicking(id: string) {
  const picking = await prisma.picking.findUniqueOrThrow({
    where: { id },
    select: { status: true, type: true },
  });

  if (picking.status === DocStatus.DONE) {
    throw new StockError(
      "A validated document cannot be canceled — its movements are already in the ledger. Record a correcting document instead.",
    );
  }

  await prisma.picking.update({ where: { id }, data: { status: DocStatus.CANCELED } });
  return picking.type;
}

export async function resetPickingToDraft(id: string) {
  const picking = await prisma.picking.findUniqueOrThrow({
    where: { id },
    select: { status: true, type: true },
  });

  if (picking.status === DocStatus.DONE) {
    throw new StockError("A validated document cannot be reopened.");
  }

  await prisma.picking.update({ where: { id }, data: { status: DocStatus.DRAFT } });
  return picking.type;
}

export async function deletePicking(id: string) {
  const picking = await prisma.picking.findUniqueOrThrow({
    where: { id },
    select: { status: true, type: true },
  });

  if (picking.status === DocStatus.DONE) {
    throw new StockError("A validated document cannot be deleted.");
  }

  await prisma.picking.delete({ where: { id } });
  return picking.type;
}

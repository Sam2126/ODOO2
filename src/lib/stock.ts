import "server-only";

import { LocationType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { StockError } from "@/lib/errors";

export type Tx = Prisma.TransactionClient;

export { StockError };

/**
 * Codes of the three virtual locations the seed creates. They belong to no
 * warehouse and are allowed to hold negative quantities: `Partners/Vendors`
 * sitting at -100 kg is simply the record that 100 kg came in from suppliers.
 */
export const VIRTUAL_LOCATION = {
  VENDORS: "VENDORS",
  CUSTOMERS: "CUSTOMERS",
  ADJUSTMENT: "ADJUSTMENT",
} as const;

export type VirtualLocationCode =
  (typeof VIRTUAL_LOCATION)[keyof typeof VIRTUAL_LOCATION];

export async function virtualLocationId(tx: Tx, code: VirtualLocationCode) {
  const location = await tx.location.findFirst({
    where: { code, warehouseId: null },
    select: { id: true },
  });
  if (!location) {
    throw new StockError(
      `The virtual location "${code}" is missing. Run "npm run db:seed" to create it.`,
    );
  }
  return location.id;
}

export type MoveInput = {
  productId: string;
  quantity: Prisma.Decimal;
  sourceLocationId: string;
  destLocationId: string;
  reference: string;
  userId: string;
  pickingId?: string;
  adjustmentId?: string;
};

/**
 * The only function in the codebase that writes StockQuant or StockMove.
 *
 * Every inventory operation — receipt, delivery, internal transfer, adjustment
 * — reduces to one or more calls to this. Callers must pass a transaction
 * client: a document that half-validates would leave the ledger and the
 * on-hand quantities disagreeing, which is the one state this model must
 * never reach.
 */
export async function applyMove(tx: Tx, move: MoveInput) {
  if (move.quantity.lessThanOrEqualTo(0)) {
    throw new StockError("Quantity must be greater than zero.");
  }
  if (move.sourceLocationId === move.destLocationId) {
    throw new StockError("Source and destination must be different locations.");
  }

  await adjustQuant(tx, move.productId, move.sourceLocationId, move.quantity.negated());
  await adjustQuant(tx, move.productId, move.destLocationId, move.quantity);

  return tx.stockMove.create({
    data: {
      productId: move.productId,
      quantity: move.quantity,
      sourceLocationId: move.sourceLocationId,
      destLocationId: move.destLocationId,
      reference: move.reference,
      pickingId: move.pickingId,
      adjustmentId: move.adjustmentId,
      createdById: move.userId,
    },
  });
}

/**
 * Applies a signed delta to one product/location pair.
 *
 * The increment happens in the database, so concurrent validations of the same
 * product do not lose updates. Real (INTERNAL) locations are then checked for
 * going negative, which aborts the surrounding transaction; virtual locations
 * are expected to go negative and are left alone.
 */
async function adjustQuant(
  tx: Tx,
  productId: string,
  locationId: string,
  delta: Prisma.Decimal,
) {
  const quant = await tx.stockQuant.upsert({
    where: { productId_locationId: { productId, locationId } },
    create: { productId, locationId, quantity: delta },
    update: { quantity: { increment: delta } },
    include: {
      location: { select: { name: true, type: true } },
      product: { select: { name: true, sku: true } },
    },
  });

  if (quant.location.type === LocationType.INTERNAL && quant.quantity.lessThan(0)) {
    const short = quant.quantity.negated();
    throw new StockError(
      `Not enough stock: ${quant.product.name} (${quant.product.sku}) in ${quant.location.name} is short by ${short.toFixed(3).replace(/\.?0+$/, "")}.`,
    );
  }

  return quant;
}

/**
 * On-hand quantity per product, counting only real locations. Virtual
 * locations are bookkeeping, so including them would always sum to zero.
 */
export async function onHandByProduct(productIds?: string[]) {
  const rows = await prisma.stockQuant.groupBy({
    by: ["productId"],
    where: {
      location: { type: LocationType.INTERNAL },
      ...(productIds ? { productId: { in: productIds } } : {}),
    },
    _sum: { quantity: true },
  });

  return new Map(rows.map((row) => [row.productId, row._sum.quantity?.toNumber() ?? 0]));
}

/** On-hand quantity of one product broken down by location. */
export async function onHandByLocation(productId: string) {
  const quants = await prisma.stockQuant.findMany({
    where: { productId, location: { type: LocationType.INTERNAL } },
    include: { location: { include: { warehouse: { select: { name: true, code: true } } } } },
    orderBy: [{ location: { warehouseId: "asc" } }, { location: { name: "asc" } }],
  });

  return quants
    .map((quant) => ({
      locationId: quant.locationId,
      locationName: quant.location.name,
      warehouseName: quant.location.warehouse?.name ?? "—",
      quantity: quant.quantity.toNumber(),
    }))
    .filter((row) => row.quantity !== 0);
}

/** On-hand quantity of one product in one specific location. */
export async function onHandAt(tx: Tx, productId: string, locationId: string) {
  const quant = await tx.stockQuant.findUnique({
    where: { productId_locationId: { productId, locationId } },
    select: { quantity: true },
  });
  return quant?.quantity ?? new Prisma.Decimal(0);
}

export type StockLevel = "OUT_OF_STOCK" | "LOW_STOCK" | "IN_STOCK";

export function stockLevel(onHand: number, minQty: number | null): StockLevel {
  if (onHand <= 0) return "OUT_OF_STOCK";
  if (minQty !== null && minQty > 0 && onHand <= minQty) return "LOW_STOCK";
  return "IN_STOCK";
}

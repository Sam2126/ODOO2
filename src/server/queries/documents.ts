import "server-only";

import {
  DocStatus,
  LocationType,
  PickingType,
  type Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/db";

const asStatus = (value?: string) =>
  value && value in DocStatus ? (value as DocStatus) : undefined;

export type DocumentFilters = {
  status?: string;
  warehouseId?: string;
  search?: string;
};

export async function listPickings(type: PickingType, filters: DocumentFilters = {}) {
  const where: Prisma.PickingWhereInput = {
    type,
    ...(asStatus(filters.status) ? { status: asStatus(filters.status) } : {}),
    ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
    ...(filters.search
      ? {
          OR: [
            { reference: { contains: filters.search, mode: "insensitive" } },
            { partnerName: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const pickings = await prisma.picking.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      reference: true,
      status: true,
      partnerName: true,
      scheduledAt: true,
      validatedAt: true,
      warehouse: { select: { name: true } },
      sourceLocation: { select: { name: true } },
      destLocation: { select: { name: true } },
      _count: { select: { lines: true } },
    },
  });

  return pickings.map((picking) => ({
    ...picking,
    lineCount: picking._count.lines,
  }));
}

export async function getPicking(id: string) {
  const picking = await prisma.picking.findUnique({
    where: { id },
    include: {
      warehouse: { select: { id: true, name: true, code: true } },
      sourceLocation: { select: { id: true, name: true, type: true } },
      destLocation: { select: { id: true, name: true, type: true } },
      createdBy: { select: { name: true } },
      lines: {
        orderBy: { product: { name: "asc" } },
        include: { product: { select: { id: true, name: true, sku: true, uom: true } } },
      },
      moves: {
        orderBy: { movedAt: "asc" },
        include: {
          product: { select: { name: true, sku: true, uom: true } },
          sourceLocation: { select: { name: true } },
          destLocation: { select: { name: true } },
        },
      },
    },
  });

  if (!picking) return null;

  return {
    ...picking,
    lines: picking.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      name: line.product.name,
      sku: line.product.sku,
      uom: line.product.uom,
      demandQty: line.demandQty.toNumber(),
      doneQty: line.doneQty.toNumber(),
    })),
    moves: picking.moves.map((move) => ({
      id: move.id,
      productName: move.product.name,
      sku: move.product.sku,
      uom: move.product.uom,
      quantity: move.quantity.toNumber(),
      from: move.sourceLocation.name,
      to: move.destLocation.name,
      movedAt: move.movedAt,
    })),
  };
}

export async function listAdjustments(filters: DocumentFilters = {}) {
  const adjustments = await prisma.adjustment.findMany({
    where: {
      ...(asStatus(filters.status) ? { status: asStatus(filters.status) } : {}),
      ...(filters.warehouseId ? { location: { warehouseId: filters.warehouseId } } : {}),
      ...(filters.search
        ? { reference: { contains: filters.search, mode: "insensitive" } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reference: true,
      status: true,
      note: true,
      createdAt: true,
      validatedAt: true,
      location: {
        select: { name: true, warehouse: { select: { name: true } } },
      },
      _count: { select: { lines: true } },
    },
  });

  return adjustments.map((adjustment) => ({
    ...adjustment,
    lineCount: adjustment._count.lines,
  }));
}

export async function getAdjustment(id: string) {
  const adjustment = await prisma.adjustment.findUnique({
    where: { id },
    include: {
      location: {
        select: { id: true, name: true, warehouse: { select: { name: true } } },
      },
      createdBy: { select: { name: true } },
      lines: {
        orderBy: { product: { name: "asc" } },
        include: { product: { select: { id: true, name: true, sku: true, uom: true } } },
      },
      moves: {
        orderBy: { movedAt: "asc" },
        include: {
          product: { select: { name: true, sku: true, uom: true } },
          sourceLocation: { select: { name: true, type: true } },
          destLocation: { select: { name: true, type: true } },
        },
      },
    },
  });

  if (!adjustment) return null;

  // While a count is still open the "system" column must show live stock, not
  // the zero placeholder the line was created with.
  const liveQuants =
    adjustment.status === "DONE"
      ? new Map<string, number>()
      : new Map(
          (
            await prisma.stockQuant.findMany({
              where: {
                locationId: adjustment.locationId,
                productId: { in: adjustment.lines.map((line) => line.productId) },
              },
              select: { productId: true, quantity: true },
            })
          ).map((quant) => [quant.productId, quant.quantity.toNumber()]),
        );

  return {
    ...adjustment,
    lines: adjustment.lines.map((line) => {
      const systemQty =
        adjustment.status === "DONE"
          ? line.systemQty.toNumber()
          : (liveQuants.get(line.productId) ?? 0);
      const countedQty = line.countedQty.toNumber();
      return {
        id: line.id,
        productId: line.productId,
        name: line.product.name,
        sku: line.product.sku,
        uom: line.product.uom,
        systemQty,
        countedQty,
        difference: countedQty - systemQty,
      };
    }),
    moves: adjustment.moves.map((move) => ({
      id: move.id,
      productName: move.product.name,
      sku: move.product.sku,
      uom: move.product.uom,
      quantity: move.quantity.toNumber(),
      // A move *out of* the adjustment location is a surplus found on the shelf.
      surplus: move.sourceLocation.type === LocationType.ADJUSTMENT,
      movedAt: move.movedAt,
    })),
  };
}

export type MoveFilters = {
  productId?: string;
  locationId?: string;
  warehouseId?: string;
  from?: string;
  to?: string;
  search?: string;
  take?: number;
};

/** The stock ledger, newest first. */
export async function listMoves(filters: MoveFilters = {}) {
  const locationScope = filters.locationId
    ? { id: filters.locationId }
    : filters.warehouseId
      ? { warehouseId: filters.warehouseId }
      : undefined;

  const where: Prisma.StockMoveWhereInput = {
    ...(filters.productId ? { productId: filters.productId } : {}),
    ...(locationScope
      ? { OR: [{ sourceLocation: locationScope }, { destLocation: locationScope }] }
      : {}),
    ...(filters.search
      ? { reference: { contains: filters.search, mode: "insensitive" } }
      : {}),
    ...(filters.from || filters.to
      ? {
          movedAt: {
            ...(filters.from ? { gte: new Date(filters.from) } : {}),
            // The "to" filter is a date, so include the whole of that day.
            ...(filters.to ? { lt: new Date(`${filters.to}T23:59:59.999`) } : {}),
          },
        }
      : {}),
  };

  const moves = await prisma.stockMove.findMany({
    where,
    orderBy: { movedAt: "desc" },
    take: filters.take ?? 200,
    include: {
      product: { select: { id: true, name: true, sku: true, uom: true } },
      sourceLocation: { select: { name: true, type: true } },
      destLocation: { select: { name: true, type: true } },
      createdBy: { select: { name: true } },
      picking: { select: { id: true, type: true } },
      adjustment: { select: { id: true } },
    },
  });

  return moves.map((move) => ({
    id: move.id,
    reference: move.reference,
    productId: move.product.id,
    productName: move.product.name,
    sku: move.product.sku,
    uom: move.product.uom,
    quantity: move.quantity.toNumber(),
    from: move.sourceLocation.name,
    fromType: move.sourceLocation.type,
    to: move.destLocation.name,
    toType: move.destLocation.type,
    movedAt: move.movedAt,
    by: move.createdBy.name,
    pickingId: move.picking?.id ?? null,
    pickingType: move.picking?.type ?? null,
    adjustmentId: move.adjustment?.id ?? null,
  }));
}

// ── Reference data for pickers and filters ───────────────────────────────────

export async function listWarehousesWithLocations() {
  return prisma.warehouse.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      address: true,
      locations: {
        where: { type: LocationType.INTERNAL },
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true },
      },
    },
  });
}

export async function listVirtualLocations() {
  return prisma.location.findMany({
    where: { warehouseId: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, type: true },
  });
}

export type ProductOption = {
  id: string;
  name: string;
  sku: string;
  uom: string;
};

export async function listProductOptions(): Promise<ProductOption[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, sku: true, uom: true },
  });
  return products;
}

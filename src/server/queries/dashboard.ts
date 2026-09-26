import "server-only";

import { DocStatus, LocationType, PickingType, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { listProducts, listProductsNeedingReorder } from "@/server/queries/products";

export type DashboardFilters = {
  warehouseId?: string;
  locationId?: string;
  categoryId?: string;
  status?: string;
  docType?: string;
};

/** Documents that have not yet moved any stock. */
const OPEN_STATUSES: DocStatus[] = [DocStatus.DRAFT, DocStatus.WAITING, DocStatus.READY];

const asStatus = (value?: string) =>
  value && value in DocStatus ? (value as DocStatus) : undefined;

const asPickingType = (value?: string) =>
  value && value in PickingType ? (value as PickingType) : undefined;

export async function getDashboardData(filters: DashboardFilters = {}) {
  // Documents are counted as "touching" a location if either end is it.
  const documentScope: Prisma.PickingWhereInput = filters.locationId
    ? {
        OR: [
          { sourceLocationId: filters.locationId },
          { destLocationId: filters.locationId },
        ],
      }
    : filters.warehouseId
      ? { warehouseId: filters.warehouseId }
      : {};

  const [products, needingReorder, pendingReceipts, pendingDeliveries, scheduledTransfers] =
    await Promise.all([
      listProducts({
        warehouseId: filters.warehouseId,
        locationId: filters.locationId,
        categoryId: filters.categoryId,
      }),
      listProductsNeedingReorder(),
      prisma.picking.count({
        where: { type: PickingType.RECEIPT, status: { in: OPEN_STATUSES }, ...documentScope },
      }),
      prisma.picking.count({
        where: { type: PickingType.DELIVERY, status: { in: OPEN_STATUSES }, ...documentScope },
      }),
      prisma.picking.count({
        where: { type: PickingType.INTERNAL, status: { in: OPEN_STATUSES }, ...documentScope },
      }),
    ]);

  const inStock = products.filter((product) => product.onHand > 0);
  const lowStock = products.filter((product) => product.level === "LOW_STOCK");
  const outOfStock = products.filter((product) => product.level === "OUT_OF_STOCK");

  const totalUnits = products.reduce((sum, product) => sum + product.onHand, 0);

  // The document table under the KPIs has its own, independent filters.
  const documentWhere: Prisma.PickingWhereInput = {
    ...(asStatus(filters.status) ? { status: asStatus(filters.status) } : {}),
    ...(asPickingType(filters.docType) ? { type: asPickingType(filters.docType) } : {}),
    ...documentScope,
  };

  const showAdjustments = !filters.docType || filters.docType === "ADJUSTMENT";
  const showPickings = filters.docType !== "ADJUSTMENT";

  const [recentPickings, recentAdjustments] = await Promise.all([
    showPickings
      ? prisma.picking.findMany({
          where: documentWhere,
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            reference: true,
            type: true,
            status: true,
            partnerName: true,
            scheduledAt: true,
            warehouse: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    showAdjustments
      ? prisma.adjustment.findMany({
          where: {
            ...(asStatus(filters.status) ? { status: asStatus(filters.status) } : {}),
            ...(filters.locationId
              ? { locationId: filters.locationId }
              : filters.warehouseId
                ? { location: { warehouseId: filters.warehouseId } }
                : {}),
          },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            reference: true,
            status: true,
            createdAt: true,
            location: { select: { name: true, warehouse: { select: { name: true } } } },
          },
        })
      : Promise.resolve([]),
  ]);

  const documents = [
    ...recentPickings.map((picking) => ({
      id: picking.id,
      reference: picking.reference,
      kind: picking.type as PickingType | "ADJUSTMENT",
      status: picking.status,
      partner: picking.partnerName,
      warehouse: picking.warehouse.name,
      date: picking.scheduledAt,
    })),
    ...recentAdjustments.map((adjustment) => ({
      id: adjustment.id,
      reference: adjustment.reference,
      kind: "ADJUSTMENT" as const,
      status: adjustment.status,
      partner: adjustment.location.name,
      warehouse: adjustment.location.warehouse?.name ?? "—",
      date: adjustment.createdAt,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 10);

  return {
    kpis: {
      productsInStock: inStock.length,
      totalProducts: products.length,
      totalUnits,
      lowStock: lowStock.length,
      outOfStock: outOfStock.length,
      pendingReceipts,
      pendingDeliveries,
      scheduledTransfers,
    },
    needingReorder: needingReorder.slice(0, 6),
    documents,
  };
}

/** Units currently held in each real location — the warehouse map on the dashboard. */
export async function getLocationTotals(warehouseId?: string, locationId?: string) {
  const quants = await prisma.stockQuant.groupBy({
    by: ["locationId"],
    where: {
      quantity: { gt: 0 },
      location: {
        type: LocationType.INTERNAL,
        ...(locationId ? { id: locationId } : warehouseId ? { warehouseId } : {}),
      },
    },
    _sum: { quantity: true },
    _count: { productId: true },
  });

  if (quants.length === 0) return [];

  const locations = await prisma.location.findMany({
    where: { id: { in: quants.map((quant) => quant.locationId) } },
    select: { id: true, name: true, warehouse: { select: { name: true } } },
  });

  const byId = new Map(locations.map((location) => [location.id, location]));

  return quants
    .map((quant) => ({
      locationId: quant.locationId,
      name: byId.get(quant.locationId)?.name ?? "—",
      warehouseName: byId.get(quant.locationId)?.warehouse?.name ?? "—",
      units: quant._sum.quantity?.toNumber() ?? 0,
      products: quant._count.productId,
    }))
    .sort((a, b) => b.units - a.units);
}

import "server-only";

import { LocationType, type Prisma, type Uom } from "@prisma/client";

import { prisma } from "@/lib/db";
import { stockLevel, type StockLevel } from "@/lib/stock";

export type ProductFilters = {
  search?: string;
  categoryId?: string;
  warehouseId?: string;
  /** "low" | "out" | "in" — anything else means no stock filter. */
  stock?: string;
  includeInactive?: boolean;
};

export type ProductRow = {
  id: string;
  name: string;
  sku: string;
  uom: Uom;
  categoryName: string | null;
  costPrice: number | null;
  isActive: boolean;
  onHand: number;
  /** Lowest reorder minimum across warehouses in scope, or null if no rule. */
  minQty: number | null;
  level: StockLevel;
};

/**
 * Products with their on-hand quantity and stock level.
 *
 * On-hand is summed from StockQuant over INTERNAL locations only — virtual
 * locations are bookkeeping and would cancel the total to zero. When a
 * warehouse filter is applied, both the quantity and the reorder minimum are
 * scoped to that warehouse, so "low stock in Jaipur" means what it says.
 */
export async function listProducts(filters: ProductFilters = {}): Promise<ProductRow[]> {
  const where: Prisma.ProductWhereInput = {
    ...(filters.includeInactive ? {} : { isActive: true }),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { sku: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const products = await prisma.product.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sku: true,
      uom: true,
      isActive: true,
      costPrice: true,
      category: { select: { name: true } },
      reorderRules: {
        where: filters.warehouseId ? { warehouseId: filters.warehouseId } : {},
        select: { minQty: true },
      },
    },
  });

  const onHand = await sumOnHand(
    products.map((product) => product.id),
    filters.warehouseId,
  );

  const rows = products.map((product) => {
    const mins = product.reorderRules.map((rule) => rule.minQty.toNumber()).filter((n) => n > 0);
    const minQty = mins.length > 0 ? Math.min(...mins) : null;
    const quantity = onHand.get(product.id) ?? 0;

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      uom: product.uom,
      categoryName: product.category?.name ?? null,
      costPrice: product.costPrice?.toNumber() ?? null,
      isActive: product.isActive,
      onHand: quantity,
      minQty,
      level: stockLevel(quantity, minQty),
    } satisfies ProductRow;
  });

  if (filters.stock === "low") return rows.filter((row) => row.level === "LOW_STOCK");
  if (filters.stock === "out") return rows.filter((row) => row.level === "OUT_OF_STOCK");
  if (filters.stock === "in") return rows.filter((row) => row.level === "IN_STOCK");
  return rows;
}

/** productId → on-hand quantity across real locations. */
export async function sumOnHand(productIds: string[], warehouseId?: string) {
  if (productIds.length === 0) return new Map<string, number>();

  const rows = await prisma.stockQuant.groupBy({
    by: ["productId"],
    where: {
      productId: { in: productIds },
      location: {
        type: LocationType.INTERNAL,
        ...(warehouseId ? { warehouseId } : {}),
      },
    },
    _sum: { quantity: true },
  });

  return new Map(rows.map((row) => [row.productId, row._sum.quantity?.toNumber() ?? 0]));
}

/** Products sitting at or below their reorder minimum. Drives the alert badge. */
export async function listProductsNeedingReorder() {
  const rules = await prisma.reorderRule.findMany({
    where: { minQty: { gt: 0 }, product: { isActive: true } },
    select: {
      minQty: true,
      maxQty: true,
      product: { select: { id: true, name: true, sku: true, uom: true } },
      warehouse: { select: { id: true, name: true } },
    },
  });

  if (rules.length === 0) return [];

  const quants = await prisma.stockQuant.groupBy({
    by: ["productId"],
    where: {
      productId: { in: rules.map((rule) => rule.product.id) },
      location: { type: LocationType.INTERNAL },
    },
    _sum: { quantity: true },
  });

  const onHand = new Map(quants.map((row) => [row.productId, row._sum.quantity?.toNumber() ?? 0]));

  return rules
    .map((rule) => {
      const quantity = onHand.get(rule.product.id) ?? 0;
      const minQty = rule.minQty.toNumber();
      const maxQty = rule.maxQty.toNumber();
      return {
        ...rule.product,
        warehouseName: rule.warehouse.name,
        onHand: quantity,
        minQty,
        // What a top-up would order: back to max, or at least up to the minimum.
        suggestedQty: Math.max(maxQty > 0 ? maxQty - quantity : minQty - quantity, 0),
        level: stockLevel(quantity, minQty),
      };
    })
    .filter((row) => row.onHand <= row.minQty)
    .sort((a, b) => a.onHand - b.onHand);
}

/** Categories with how many products sit in each — used by filter dropdowns. */
export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { products: true } } },
  });
}

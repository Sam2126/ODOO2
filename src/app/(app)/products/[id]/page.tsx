import { Archive, ArchiveRestore, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionButton, ActionGroup } from "@/components/action-button";
import { ProductForm } from "@/components/products/product-form";
import { ReorderRules } from "@/components/products/reorder-rules";
import { Badge, StockBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { EmptyRow, TBody, TD, TH, THead, TR, Table, TableShell } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { onHandByLocation, stockLevel } from "@/lib/stock";
import { formatDateTime, formatMoney, formatQty, uomLabel } from "@/lib/utils";
import { toggleProductActiveAction } from "@/server/actions/products";
import { listMoves, listWarehousesWithLocations } from "@/server/queries/documents";
import { listCategories, sumOnHand } from "@/server/queries/products";

export async function generateMetadata({
  params,
}: PageProps<"/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: product?.name ?? "Product" };
}

export default async function ProductDetailPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      reorderRules: {
        include: { warehouse: { select: { id: true, name: true } } },
        orderBy: { warehouse: { name: "asc" } },
      },
    },
  });

  if (!product) notFound();

  const [byLocation, moves, categories, warehouses, totals] = await Promise.all([
    onHandByLocation(product.id),
    listMoves({ productId: product.id, take: 40 }),
    listCategories(),
    listWarehousesWithLocations(),
    sumOnHand([product.id]),
  ]);

  const onHand = totals.get(product.id) ?? 0;

  // Per-warehouse quantities, so each reorder rule is shown against the stock
  // it actually governs rather than the company-wide total.
  const perWarehouse = new Map<string, number>();
  for (const warehouse of warehouses) {
    const ids = new Set(warehouse.locations.map((location) => location.id));
    perWarehouse.set(
      warehouse.id,
      byLocation
        .filter((row) => ids.has(row.locationId))
        .reduce((sum, row) => sum + row.quantity, 0),
    );
  }

  const mins = product.reorderRules
    .map((rule) => rule.minQty.toNumber())
    .filter((value) => value > 0);
  const level = stockLevel(onHand, mins.length > 0 ? Math.min(...mins) : null);

  const locationOptions = warehouses.flatMap((warehouse) =>
    warehouse.locations.map((location) => ({
      id: location.id,
      name: location.name,
      warehouseName: warehouse.name,
    })),
  );

  return (
    <>
      <PageHeader
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="tabular font-mono text-xs text-muted-foreground">{product.sku}</span>
            <StockBadge level={level} />
            {product.category ? <Badge>{product.category.name}</Badge> : null}
            {product.isActive ? null : <Badge tone="danger">Archived</Badge>}
          </span>
        }
        actions={
          <ButtonLink href="/products" variant="ghost">
            Back to products
          </ButtonLink>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface px-4 py-3.5">
          <p className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
            On hand
          </p>
          <p className="tabular mt-2 text-2xl font-semibold">
            {formatQty(onHand)}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {uomLabel(product.uom)}
            </span>
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface px-4 py-3.5">
          <p className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
            Locations holding it
          </p>
          <p className="tabular mt-2 text-2xl font-semibold">{byLocation.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface px-4 py-3.5">
          <p className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
            Cost price
          </p>
          <p className="tabular mt-2 text-2xl font-semibold">
            {formatMoney(product.costPrice?.toNumber() ?? null)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface px-4 py-3.5">
          <p className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
            Stock value at cost
          </p>
          <p className="tabular mt-2 text-2xl font-semibold">
            {formatMoney(onHand * (product.costPrice?.toNumber() ?? 0))}
          </p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Stock by location"
              description="Only real locations. Virtual ones are bookkeeping."
            />
            {byLocation.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title="Nothing on any shelf"
                description="Validate a receipt to bring this product into stock."
                action={
                  <ButtonLink href="/receipts/new" size="sm">
                    New receipt
                  </ButtonLink>
                }
              />
            ) : (
              <TableShell className="rounded-none border-0">
                <Table>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Location</TH>
                      <TH>Warehouse</TH>
                      <TH className="text-right">Quantity</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {byLocation.map((row) => (
                      <TR key={row.locationId}>
                        <TD className="font-medium">{row.locationName}</TD>
                        <TD className="text-muted-foreground">{row.warehouseName}</TD>
                        <TD className="tabular text-right font-medium">
                          {formatQty(row.quantity, product.uom)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableShell>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Move history"
              description="Every movement of this product, newest first."
              action={
                <ButtonLink href={`/moves?product=${product.id}`} variant="ghost" size="sm">
                  Open in ledger
                </ButtonLink>
              }
            />
            <TableShell className="rounded-none border-0">
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Reference</TH>
                    <TH className="text-right">Quantity</TH>
                    <TH>From</TH>
                    <TH>To</TH>
                    <TH>When</TH>
                  </TR>
                </THead>
                <TBody>
                  {moves.length === 0 ? (
                    <EmptyRow colSpan={5}>
                      Nothing has moved yet.
                    </EmptyRow>
                  ) : (
                    moves.map((move) => (
                      <TR key={move.id}>
                        <TD className="tabular font-mono text-xs">{move.reference}</TD>
                        <TD className="tabular text-right font-medium">
                          {formatQty(move.quantity)}
                        </TD>
                        <TD className="text-muted-foreground">{move.from}</TD>
                        <TD className="text-muted-foreground">{move.to}</TD>
                        <TD className="tabular text-muted-foreground">
                          {formatDateTime(move.movedAt)}
                        </TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>
            </TableShell>
          </Card>

          <Card>
            <CardHeader title="Edit product" />
            <CardBody>
              <ProductForm
                categories={categories}
                locations={locationOptions}
                product={{
                  id: product.id,
                  name: product.name,
                  sku: product.sku,
                  uom: product.uom,
                  categoryId: product.categoryId,
                  costPrice: product.costPrice?.toNumber() ?? null,
                  salePrice: product.salePrice?.toNumber() ?? null,
                  isActive: product.isActive,
                }}
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="h-fit">
            <CardHeader
              title="Reordering rules"
              description="A minimum per warehouse drives the low-stock alerts."
            />
            <CardBody>
              <ReorderRules
                productId={product.id}
                warehouses={warehouses.map((warehouse) => ({
                  id: warehouse.id,
                  name: warehouse.name,
                }))}
                rules={product.reorderRules.map((rule) => ({
                  id: rule.id,
                  warehouseId: rule.warehouseId,
                  warehouseName: rule.warehouse.name,
                  minQty: rule.minQty.toNumber(),
                  maxQty: rule.maxQty.toNumber(),
                  onHand: perWarehouse.get(rule.warehouseId) ?? 0,
                }))}
              />
            </CardBody>
          </Card>

          <Card className="h-fit">
            <CardHeader
              title={product.isActive ? "Archive" : "Restore"}
              description={
                product.isActive
                  ? "Archived products stay on past documents but cannot be added to new ones."
                  : "Bring this product back into the catalogue."
              }
            />
            <CardBody>
              <ActionGroup>
                <ActionButton
                  action={toggleProductActiveAction}
                  id={product.id}
                  variant="secondary"
                  confirm={product.isActive ? "Confirm archive" : "Confirm restore"}
                >
                  {product.isActive ? <Archive aria-hidden /> : <ArchiveRestore aria-hidden />}
                  {product.isActive ? "Archive product" : "Restore product"}
                </ActionButton>
              </ActionGroup>
            </CardBody>
          </Card>

          <Card className="h-fit">
            <CardHeader title="Move this stock" />
            <CardBody className="flex flex-wrap gap-2">
              <ButtonLink href="/receipts/new" variant="secondary" size="sm">
                Receive
              </ButtonLink>
              <ButtonLink href="/deliveries/new" variant="secondary" size="sm">
                Deliver
              </ButtonLink>
              <ButtonLink href="/transfers/new" variant="secondary" size="sm">
                Transfer
              </ButtonLink>
              <ButtonLink href="/adjustments/new" variant="secondary" size="sm">
                Count
              </ButtonLink>
            </CardBody>
          </Card>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        <Link href="/moves" className="hover:text-foreground hover:underline">
          The stock ledger
        </Link>{" "}
        is append-only, which is why quantities here are always derived and never typed in
        directly.
      </p>
    </>
  );
}

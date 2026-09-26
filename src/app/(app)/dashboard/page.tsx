import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Boxes,
  ClipboardCheck,
  PackageX,
  TriangleAlert,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FilterBar, FilterSelect } from "@/components/filters";
import { KpiTile } from "@/components/kpi-tile";
import { Alert } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { EmptyRow, TBody, TD, TH, THead, TR, Table, TableShell } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { formatDate, formatQty } from "@/lib/utils";
import { getDashboardData, getLocationTotals } from "@/server/queries/dashboard";
import { listCategories } from "@/server/queries/products";
import { listWarehousesWithLocations } from "@/server/queries/documents";

export const metadata: Metadata = { title: "Dashboard" };

const DOC_LABEL: Record<string, string> = {
  RECEIPT: "Receipt",
  DELIVERY: "Delivery",
  INTERNAL: "Transfer",
  ADJUSTMENT: "Adjustment",
};

const DOC_HREF: Record<string, string> = {
  RECEIPT: "/receipts",
  DELIVERY: "/deliveries",
  INTERNAL: "/transfers",
  ADJUSTMENT: "/adjustments",
};

const one = (value: string | string[] | undefined) =>
  typeof value === "string" && value !== "" ? value : undefined;

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser();
  const params = await searchParams;

  const filters = {
    warehouseId: one(params.warehouse),
    locationId: one(params.location),
    categoryId: one(params.category),
    status: one(params.status),
    docType: one(params.type),
  };

  const [data, locationTotals, warehouses, categories] = await Promise.all([
    getDashboardData(filters),
    getLocationTotals(filters.warehouseId, filters.locationId),
    listWarehousesWithLocations(),
    listCategories(),
  ]);

  const { kpis } = data;
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Good to see you, ${firstName}`}
        description={
          filters.locationId
            ? "Scoped to one location: quantities and document counts cover that location only."
            : filters.warehouseId
              ? "Scoped to one warehouse."
              : "Where your stock stands right now, and what is waiting to be processed."
        }
        actions={
          <>
            <ButtonLink href="/receipts/new" variant="secondary">
              <ArrowDownToLine aria-hidden />
              New receipt
            </ButtonLink>
            <ButtonLink href="/deliveries/new">
              <ArrowUpFromLine aria-hidden />
              New delivery
            </ButtonLink>
          </>
        }
      />

      {params.denied === "managers-only" ? (
        <Alert tone="warning">
          That section is limited to inventory managers. You are signed in as warehouse staff.
        </Alert>
      ) : null}

      <FilterBar activeCount={activeFilters} basePath="/dashboard">
        <FilterSelect
          name="warehouse"
          label="Warehouse"
          allLabel="All warehouses"
          options={warehouses.map((warehouse) => ({
            value: warehouse.id,
            label: warehouse.name,
          }))}
        />
        <FilterSelect
          name="location"
          label="Location"
          allLabel="All locations"
          options={warehouses.flatMap((warehouse) =>
            warehouse.locations.map((location) => ({
              value: location.id,
              label: `${location.name} — ${warehouse.name}`,
            })),
          )}
          className="w-full sm:w-56"
        />
        <FilterSelect
          name="category"
          label="Category"
          allLabel="All categories"
          options={categories.map((category) => ({
            value: category.id,
            label: `${category.name} (${category._count.products})`,
          }))}
        />
        <FilterSelect
          name="type"
          label="Document type"
          allLabel="All documents"
          options={[
            { value: "RECEIPT", label: "Receipts" },
            { value: "DELIVERY", label: "Delivery orders" },
            { value: "INTERNAL", label: "Internal transfers" },
            { value: "ADJUSTMENT", label: "Adjustments" },
          ]}
        />
        <FilterSelect
          name="status"
          label="Status"
          allLabel="Any status"
          options={[
            { value: "DRAFT", label: "Draft" },
            { value: "WAITING", label: "Waiting" },
            { value: "READY", label: "Ready" },
            { value: "DONE", label: "Done" },
            { value: "CANCELED", label: "Canceled" },
          ]}
        />
      </FilterBar>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiTile
          label="Products in stock"
          value={kpis.productsInStock}
          caption={`${formatQty(kpis.totalUnits)} units across ${kpis.totalProducts} products`}
          icon={Boxes}
          tone="primary"
          href="/products?stock=in"
        />
        <KpiTile
          label="Low stock"
          value={kpis.lowStock}
          caption="At or below the reorder minimum"
          icon={TriangleAlert}
          tone={kpis.lowStock > 0 ? "warning" : "neutral"}
          href="/products?stock=low"
        />
        <KpiTile
          label="Out of stock"
          value={kpis.outOfStock}
          caption="Nothing on any shelf"
          icon={PackageX}
          tone={kpis.outOfStock > 0 ? "danger" : "neutral"}
          href="/products?stock=out"
        />
        <KpiTile
          label="Pending receipts"
          value={kpis.pendingReceipts}
          caption="Awaiting validation"
          icon={ArrowDownToLine}
          tone="neutral"
          href="/receipts"
        />
        <KpiTile
          label="Pending deliveries"
          value={kpis.pendingDeliveries}
          caption={`${kpis.scheduledTransfers} internal transfer${kpis.scheduledTransfers === 1 ? "" : "s"} scheduled`}
          icon={ArrowUpFromLine}
          tone="neutral"
          href="/deliveries"
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title="Recent documents"
            description="Receipts, deliveries, transfers and counts, newest first."
            action={
              <ButtonLink href="/moves" variant="ghost" size="sm">
                View the ledger
              </ButtonLink>
            }
          />
          <TableShell className="rounded-none border-0">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Reference</TH>
                  <TH>Type</TH>
                  <TH>Partner / Location</TH>
                  <TH>Warehouse</TH>
                  <TH>Date</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {data.documents.length === 0 ? (
                  <EmptyRow colSpan={6}>
                    No documents match these filters.
                  </EmptyRow>
                ) : (
                  data.documents.map((document) => (
                    <TR key={`${document.kind}-${document.id}`}>
                      <TD>
                        <Link
                          href={`${DOC_HREF[document.kind]}/${document.id}`}
                          className="tabular font-mono text-[0.8125rem] font-medium text-primary hover:underline"
                        >
                          {document.reference}
                        </Link>
                      </TD>
                      <TD className="text-muted-foreground">{DOC_LABEL[document.kind]}</TD>
                      <TD className="max-w-48 truncate">{document.partner ?? "—"}</TD>
                      <TD className="text-muted-foreground">{document.warehouse}</TD>
                      <TD className="tabular text-muted-foreground">
                        {formatDate(document.date)}
                      </TD>
                      <TD>
                        <StatusBadge status={document.status} />
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableShell>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Needs reordering"
              description="On hand is at or below the minimum you set."
            />
            {data.needingReorder.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="Everything is above its minimum"
                description="Reordering rules are set on a product's detail page."
              />
            ) : (
              <ul className="divide-y divide-border">
                {data.needingReorder.map((item) => (
                  <li key={`${item.id}-${item.warehouseName}`}>
                    <Link
                      href={`/products/${item.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-muted/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{item.name}</span>
                        <span className="tabular block font-mono text-xs text-muted-foreground">
                          {item.sku} · {item.warehouseName}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="tabular block text-sm font-semibold">
                          {formatQty(item.onHand, item.uom)}
                        </span>
                        <span className="tabular block text-xs text-muted-foreground">
                          min {formatQty(item.minQty)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Stock by location" description="Units held in each real location." />
            {locationTotals.length === 0 ? (
              <EmptyState
                icon={Boxes}
                title="No stock recorded yet"
                description="Validate a receipt and the locations will fill in here."
                action={
                  <ButtonLink href="/receipts/new" size="sm">
                    Create a receipt
                  </ButtonLink>
                }
              />
            ) : (
              <CardBody className="space-y-2.5">
                {locationTotals.slice(0, 7).map((location) => {
                  const share = Math.round(
                    (location.units / locationTotals[0].units) * 100,
                  );
                  return (
                    <div key={location.locationId}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-medium">{location.name}</span>
                        <span className="tabular shrink-0 text-muted-foreground">
                          {formatQty(location.units)}
                        </span>
                      </div>
                      <div
                        className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted"
                        role="presentation"
                      >
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(share, 2)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {location.products} product{location.products === 1 ? "" : "s"} ·{" "}
                        {location.warehouseName}
                      </p>
                    </div>
                  );
                })}
              </CardBody>
            )}
          </Card>

          <Card>
            <CardHeader title="Jump to" />
            <CardBody className="flex flex-wrap gap-2">
              <ButtonLink href="/transfers/new" variant="secondary" size="sm">
                <ArrowLeftRight aria-hidden />
                Internal transfer
              </ButtonLink>
              <ButtonLink href="/adjustments/new" variant="secondary" size="sm">
                <ClipboardCheck aria-hidden />
                Stock count
              </ButtonLink>
              <ButtonLink href="/products/new" variant="secondary" size="sm">
                <Boxes aria-hidden />
                New product
              </ButtonLink>
            </CardBody>
          </Card>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Signed in as {user.email} ·{" "}
        <Badge tone={user.role === "MANAGER" ? "primary" : "neutral"}>
          {user.role === "MANAGER" ? "Inventory manager" : "Warehouse staff"}
        </Badge>
      </p>
    </>
  );
}

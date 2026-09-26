import { LocationType } from "@prisma/client";
import { ArrowRight, History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DateFilter, FilterBar, FilterSelect, SearchInput } from "@/components/filters";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { TBody, TD, TH, THead, TR, Table, TableShell } from "@/components/ui/table";
import { cn, formatDateTime, formatQty } from "@/lib/utils";
import { listMoves, listWarehousesWithLocations } from "@/server/queries/documents";
import { listProducts } from "@/server/queries/products";

export const metadata: Metadata = { title: "Move history" };

const one = (value: string | string[] | undefined) =>
  typeof value === "string" && value !== "" ? value : undefined;

const DOC_HREF: Record<string, string> = {
  RECEIPT: "/receipts",
  DELIVERY: "/deliveries",
  INTERNAL: "/transfers",
};

/** Virtual endpoints are the interesting ones — they mark stock entering or leaving. */
function LocationCell({ name, type }: { name: string; type: LocationType }) {
  const virtual = type !== LocationType.INTERNAL;
  return (
    <span className={cn(virtual ? "text-muted-foreground italic" : "text-foreground")}>
      {name}
    </span>
  );
}

export default async function MovesPage({ searchParams }: PageProps<"/moves">) {
  const params = await searchParams;

  const filters = {
    productId: one(params.product),
    warehouseId: one(params.warehouse),
    locationId: one(params.location),
    from: one(params.from),
    to: one(params.to),
    search: one(params.q),
  };

  const [moves, products, warehouses] = await Promise.all([
    listMoves({ ...filters, take: 300 }),
    listProducts({ includeInactive: true }),
    listWarehousesWithLocations(),
  ]);

  const locations = warehouses.flatMap((warehouse) =>
    warehouse.locations.map((location) => ({
      value: location.id,
      label: `${location.name} — ${warehouse.name}`,
    })),
  );

  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="Move history"
        description="The stock ledger. Every movement ever recorded, append-only and never edited."
      />

      <FilterBar activeCount={activeFilters} basePath="/moves">
        <SearchInput placeholder="Document reference…" className="w-full sm:w-56" />
        <FilterSelect
          name="product"
          label="Product"
          allLabel="All products"
          options={products.map((product) => ({
            value: product.id,
            label: `${product.name} (${product.sku})`,
          }))}
          className="w-full sm:w-64"
        />
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
          options={locations}
          className="w-full sm:w-56"
        />
        <DateFilter name="from" label="From" />
        <DateFilter name="to" label="To" />
      </FilterBar>

      {moves.length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title={activeFilters > 0 ? "No movements match these filters" : "The ledger is empty"}
            description={
              activeFilters > 0
                ? "Try widening the date range or clearing a filter."
                : "Validate a receipt and its movements appear here immediately."
            }
          />
        </Card>
      ) : (
        <>
          <TableShell>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>When</TH>
                  <TH>Reference</TH>
                  <TH>Product</TH>
                  <TH className="text-right">Quantity</TH>
                  <TH>Movement</TH>
                  <TH>By</TH>
                </TR>
              </THead>
              <TBody>
                {moves.map((move) => {
                  const href = move.pickingType
                    ? `${DOC_HREF[move.pickingType]}/${move.pickingId}`
                    : move.adjustmentId
                      ? `/adjustments/${move.adjustmentId}`
                      : null;

                  return (
                    <TR key={move.id}>
                      <TD className="tabular whitespace-nowrap text-muted-foreground">
                        {formatDateTime(move.movedAt)}
                      </TD>
                      <TD>
                        {href ? (
                          <Link
                            href={href}
                            className="tabular font-mono text-xs font-medium text-accent hover:underline"
                          >
                            {move.reference}
                          </Link>
                        ) : (
                          <span className="tabular font-mono text-xs text-muted-foreground">
                            {move.reference}
                          </span>
                        )}
                      </TD>
                      <TD>
                        <Link
                          href={`/products/${move.productId}`}
                          className="font-medium hover:text-accent hover:underline"
                        >
                          {move.productName}
                        </Link>
                        <span className="tabular block font-mono text-xs text-muted-foreground">
                          {move.sku}
                        </span>
                      </TD>
                      <TD className="tabular text-right font-medium whitespace-nowrap">
                        {formatQty(move.quantity, move.uom)}
                      </TD>
                      <TD>
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          <LocationCell name={move.from} type={move.fromType} />
                          <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                          <LocationCell name={move.to} type={move.toType} />
                        </span>
                      </TD>
                      <TD className="text-muted-foreground">{move.by}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableShell>

          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              Showing {moves.length} movement{moves.length === 1 ? "" : "s"}
              {moves.length === 300 ? " (most recent 300)" : ""}.
            </span>
            <Badge>Italic locations are virtual</Badge>
            <span>
              A move out of <em>Partners/Vendors</em> is stock arriving; a move into{" "}
              <em>Partners/Customers</em> is stock shipping.
            </span>
          </p>
        </>
      )}
    </>
  );
}

import { Package, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FilterBar, FilterSelect, SearchInput } from "@/components/filters";
import { StockBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { EmptyRow, TBody, TD, TH, THead, TR, Table, TableShell } from "@/components/ui/table";
import { formatMoney, formatQty, uomLabel } from "@/lib/utils";
import { listWarehousesWithLocations } from "@/server/queries/documents";
import { listCategories, listProducts } from "@/server/queries/products";

export const metadata: Metadata = { title: "Products" };

const one = (value: string | string[] | undefined) =>
  typeof value === "string" && value !== "" ? value : undefined;

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const params = await searchParams;

  const filters = {
    search: one(params.q),
    categoryId: one(params.category),
    warehouseId: one(params.warehouse),
    stock: one(params.stock),
    includeInactive: params.archived === "1",
  };

  const [products, categories, warehouses] = await Promise.all([
    listProducts(filters),
    listCategories(),
    listWarehousesWithLocations(),
  ]);

  const activeFilters = [
    filters.search,
    filters.categoryId,
    filters.warehouseId,
    filters.stock,
    filters.includeInactive ? "1" : undefined,
  ].filter(Boolean).length;

  const totalUnits = products.reduce((sum, product) => sum + product.onHand, 0);
  // Cost price is per unit, so this is what the shelves are worth right now.
  const stockValue = products.reduce(
    (sum, product) => sum + product.onHand * (product.costPrice ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        title="Products"
        description={
          filters.warehouseId
            ? "Quantities and reorder minimums are scoped to the selected warehouse."
            : "On-hand quantity is summed across every real location."
        }
        actions={
          <ButtonLink href="/products/new">
            <Plus aria-hidden />
            New product
          </ButtonLink>
        }
      />

      <FilterBar activeCount={activeFilters} basePath="/products">
        <SearchInput placeholder="Name or SKU…" className="w-full sm:w-64" />
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
          name="warehouse"
          label="Warehouse"
          allLabel="All warehouses"
          options={warehouses.map((warehouse) => ({
            value: warehouse.id,
            label: warehouse.name,
          }))}
        />
        <FilterSelect
          name="stock"
          label="Stock level"
          allLabel="Any level"
          options={[
            { value: "in", label: "In stock" },
            { value: "low", label: "Low stock" },
            { value: "out", label: "Out of stock" },
          ]}
        />
        <FilterSelect
          name="archived"
          label="Archived"
          allLabel="Active only"
          options={[{ value: "1", label: "Include archived" }]}
        />
      </FilterBar>

      {products.length === 0 && activeFilters === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title="No products yet"
            description="Add your first product, then record a receipt to bring stock in."
            action={
              <ButtonLink href="/products/new" size="sm">
                <Plus aria-hidden />
                New product
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <>
          <TableShell>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Product</TH>
                  <TH>SKU</TH>
                  <TH>Category</TH>
                  <TH className="text-right">On hand</TH>
                  <TH className="text-right">Min</TH>
                  <TH className="text-right">Cost</TH>
                  <TH>Stock level</TH>
                </TR>
              </THead>
              <TBody>
                {products.length === 0 ? (
                  <EmptyRow colSpan={7}>No products match these filters.</EmptyRow>
                ) : (
                  products.map((product) => (
                    <TR key={product.id}>
                      <TD>
                        <Link
                          href={`/products/${product.id}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {product.name}
                        </Link>
                        {product.isActive ? null : (
                          <span className="ml-2 text-xs text-muted-foreground">(archived)</span>
                        )}
                      </TD>
                      <TD className="tabular font-mono text-xs text-muted-foreground">
                        {product.sku}
                      </TD>
                      <TD className="text-muted-foreground">{product.categoryName ?? "—"}</TD>
                      <TD className="tabular text-right font-medium">
                        {formatQty(product.onHand)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          {uomLabel(product.uom)}
                        </span>
                      </TD>
                      <TD className="tabular text-right text-muted-foreground">
                        {product.minQty === null ? "—" : formatQty(product.minQty)}
                      </TD>
                      <TD className="tabular text-right text-muted-foreground">
                        {formatMoney(product.costPrice)}
                      </TD>
                      <TD>
                        <StockBadge level={product.level} />
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableShell>

          <p className="text-xs text-muted-foreground">
            {products.length} product{products.length === 1 ? "" : "s"} ·{" "}
            {formatQty(totalUnits)} units on hand · {formatMoney(stockValue)} at cost
          </p>
        </>
      )}
    </>
  );
}

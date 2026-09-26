import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdjustmentForm } from "@/components/documents/adjustment-form";
import { FilterBar, FilterSelect } from "@/components/filters";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { locationCountSheet } from "@/server/services/adjustments";
import { listProductOptions, listWarehousesWithLocations } from "@/server/queries/documents";

export const metadata: Metadata = { title: "New count" };

export default async function NewAdjustmentPage({ searchParams }: PageProps<"/adjustments/new">) {
  const params = await searchParams;
  const [warehouses, products] = await Promise.all([
    listWarehousesWithLocations(),
    listProductOptions(),
  ]);

  const locations = warehouses.flatMap((warehouse) =>
    warehouse.locations.map((location) => ({
      id: location.id,
      label: `${location.name} — ${warehouse.name}`,
      name: location.name,
    })),
  );

  if (locations.length === 0) redirect("/settings/warehouses?setup=1");

  const requested = typeof params.location === "string" ? params.location : undefined;
  const selected = locations.find((location) => location.id === requested) ?? locations[0];

  // Pre-fill with what the system currently believes is on that shelf, so the
  // person counting only has to correct the lines that differ.
  const sheet = await locationCountSheet(selected.id);

  return (
    <>
      <PageHeader
        title="New inventory adjustment"
        description="Pick the location you counted. Every product already there is listed for you."
        actions={
          <ButtonLink href="/adjustments" variant="ghost">
            Cancel
          </ButtonLink>
        }
      />

      <FilterBar activeCount={requested ? 1 : 0} basePath="/adjustments/new">
        <FilterSelect
          name="location"
          label="Location to count"
          allLabel={selected.label}
          options={locations.map((location) => ({
            value: location.id,
            label: location.label,
          }))}
          className="w-full sm:w-80"
        />
      </FilterBar>

      {sheet.length === 0 ? (
        <Alert tone="info">
          {selected.name} currently holds no stock. Add products below to record a surplus found
          during the count.
        </Alert>
      ) : null}

      <AdjustmentForm
        key={selected.id}
        locationId={selected.id}
        locationName={selected.name}
        products={products}
        initialLines={sheet.map((line) => ({
          productId: line.productId,
          name: line.name,
          sku: line.sku,
          uom: line.uom,
          systemQty: line.systemQty,
          // Defaults to the system quantity: a clean count corrects nothing.
          countedQty: line.systemQty,
        }))}
      />
    </>
  );
}

import { LocationType } from "@prisma/client";
import type { Metadata } from "next";

import { WarehouseManager } from "@/components/settings/warehouse-manager";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/card";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listVirtualLocations } from "@/server/queries/documents";

export const metadata: Metadata = { title: "Warehouses" };

export default async function WarehousesPage({ searchParams }: PageProps<"/settings/warehouses">) {
  await requireManager();
  const params = await searchParams;

  const [warehouses, virtualLocations] = await Promise.all([
    prisma.warehouse.findMany({
      orderBy: { name: "asc" },
      include: {
        locations: {
          where: { type: LocationType.INTERNAL },
          orderBy: { name: "asc" },
          include: {
            quants: { select: { quantity: true, productId: true } },
          },
        },
      },
    }),
    listVirtualLocations(),
  ]);

  const rows = warehouses.map((warehouse) => ({
    id: warehouse.id,
    name: warehouse.name,
    code: warehouse.code,
    address: warehouse.address,
    locations: warehouse.locations.map((location) => {
      const held = location.quants.filter((quant) => !quant.quantity.isZero());
      return {
        id: location.id,
        name: location.name,
        code: location.code,
        units: held.reduce((sum, quant) => sum + quant.quantity.toNumber(), 0),
        products: held.length,
      };
    }),
  }));

  return (
    <>
      <PageHeader
        title="Warehouses"
        description="Warehouses and the locations inside them. A location is anywhere stock can physically sit."
      />

      {params.setup === "1" ? (
        <Alert tone="warning">
          There are no warehouses yet, so there is nowhere to put stock. Create one below first.
        </Alert>
      ) : null}

      <WarehouseManager warehouses={rows} />

      <div className="rounded-lg border border-dashed border-border bg-surface-muted/40 px-5 py-4">
        <h2 className="text-sm font-semibold">Virtual locations</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          These belong to no warehouse and cannot be edited. They are the counterparties that make
          every operation a movement between two locations: a receipt comes out of the vendor
          location, a delivery goes into the customer location, and a stock correction is balanced
          against the adjustment location.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {virtualLocations.map((location) => (
            <li
              key={location.id}
              className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs"
            >
              <span className="font-medium">{location.name}</span>
              <span className="tabular ml-2 font-mono text-muted-foreground">
                {location.type}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

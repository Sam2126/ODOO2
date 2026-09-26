import { DocStatus } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import type { PickingConfig } from "@/components/documents/config";
import { PickingForm } from "@/components/documents/picking-form";
import { PageHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import {
  getPicking,
  listProductOptions,
  listVirtualLocations,
  listWarehousesWithLocations,
} from "@/server/queries/documents";

async function referenceData() {
  const [warehouses, virtualLocations, products] = await Promise.all([
    listWarehousesWithLocations(),
    listVirtualLocations(),
    listProductOptions(),
  ]);
  return { warehouses, virtualLocations, products };
}

export async function PickingNewPage({ config }: { config: PickingConfig }) {
  const { warehouses, virtualLocations, products } = await referenceData();

  if (warehouses.length === 0) {
    redirect("/settings/warehouses?setup=1");
  }

  return (
    <>
      <PageHeader
        title={`New ${config.singular.toLowerCase()}`}
        description={config.description}
        actions={
          <ButtonLink href={config.route} variant="ghost">
            Cancel
          </ButtonLink>
        }
      />
      <PickingForm
        config={config}
        warehouses={warehouses}
        virtualLocations={virtualLocations}
        products={products}
      />
    </>
  );
}

export async function PickingEditPage({
  config,
  id,
}: {
  config: PickingConfig;
  id: string;
}) {
  const [document, reference] = await Promise.all([getPicking(id), referenceData()]);

  if (!document || document.type !== config.type) notFound();

  // A validated document is history; editing it would desync the ledger.
  if (document.status === DocStatus.DONE) {
    redirect(`${config.route}/${id}`);
  }

  return (
    <>
      <PageHeader
        title={`Edit ${document.reference}`}
        description={`${config.singular} · ${document.status.charAt(0)}${document.status.slice(1).toLowerCase()}`}
        actions={
          <ButtonLink href={`${config.route}/${id}`} variant="ghost">
            Cancel
          </ButtonLink>
        }
      />
      <PickingForm
        config={config}
        warehouses={reference.warehouses}
        virtualLocations={reference.virtualLocations}
        products={reference.products}
        document={{
          id: document.id,
          warehouseId: document.warehouseId,
          sourceLocationId: document.sourceLocationId,
          destLocationId: document.destLocationId,
          partnerName: document.partnerName,
          scheduledAt: document.scheduledAt,
          note: document.note,
          lines: document.lines.map((line) => ({
            productId: line.productId,
            name: line.name,
            sku: line.sku,
            uom: line.uom,
            demandQty: line.demandQty,
            doneQty: line.doneQty,
          })),
        }}
      />
    </>
  );
}

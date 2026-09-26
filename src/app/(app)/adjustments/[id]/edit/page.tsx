import { DocStatus } from "@prisma/client";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AdjustmentForm } from "@/components/documents/adjustment-form";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { listProductOptions } from "@/server/queries/documents";
import { getAdjustment } from "@/server/queries/documents";

export const metadata: Metadata = { title: "Edit count" };

export default async function EditAdjustmentPage({
  params,
}: PageProps<"/adjustments/[id]/edit">) {
  const { id } = await params;
  const [adjustment, products] = await Promise.all([getAdjustment(id), listProductOptions()]);

  if (!adjustment) notFound();

  // An applied count is history; changing it would contradict the ledger.
  if (adjustment.status === DocStatus.DONE) redirect(`/adjustments/${id}`);

  return (
    <>
      <PageHeader
        title={`Edit ${adjustment.reference}`}
        description={`${adjustment.location.name} · ${adjustment.location.warehouse?.name ?? "—"}`}
        actions={
          <ButtonLink href={`/adjustments/${id}`} variant="ghost">
            Cancel
          </ButtonLink>
        }
      />
      <AdjustmentForm
        locationId={adjustment.location.id}
        locationName={adjustment.location.name}
        products={products}
        document={{ id: adjustment.id, note: adjustment.note }}
        initialLines={adjustment.lines.map((line) => ({
          productId: line.productId,
          name: line.name,
          sku: line.sku,
          uom: line.uom,
          systemQty: line.systemQty,
          countedQty: line.countedQty,
        }))}
      />
    </>
  );
}

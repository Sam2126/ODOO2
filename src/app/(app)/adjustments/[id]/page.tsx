import { DocStatus } from "@prisma/client";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdjustmentActions } from "@/components/documents/adjustment-actions";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { EmptyRow, TBody, TD, TH, THead, TR, Table, TableShell } from "@/components/ui/table";
import { cn, formatDateTime, formatQty } from "@/lib/utils";
import { getAdjustment } from "@/server/queries/documents";

export const metadata: Metadata = { title: "Inventory adjustment" };

export default async function AdjustmentDetailPage({
  params,
}: PageProps<"/adjustments/[id]">) {
  const { id } = await params;
  const adjustment = await getAdjustment(id);
  if (!adjustment) notFound();

  const applied = adjustment.status === DocStatus.DONE;
  const corrections = adjustment.lines.filter((line) => line.difference !== 0);
  const surplus = corrections
    .filter((line) => line.difference > 0)
    .reduce((sum, line) => sum + line.difference, 0);
  const shortage = corrections
    .filter((line) => line.difference < 0)
    .reduce((sum, line) => sum + line.difference, 0);

  return (
    <>
      <PageHeader
        title={adjustment.reference}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={adjustment.status} />
            <span className="text-sm text-muted-foreground">
              {adjustment.location.name} · {adjustment.location.warehouse?.name ?? "—"}
            </span>
          </span>
        }
        actions={
          <ButtonLink href="/adjustments" variant="ghost">
            Back to adjustments
          </ButtonLink>
        }
      />

      <AdjustmentActions id={adjustment.id} status={adjustment.status} />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Counted quantities"
              description={
                applied
                  ? "System quantities are as they stood when the count was applied."
                  : "System quantities are live and will be read again when you apply the count."
              }
            />
            <TableShell className="rounded-none border-0">
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Product</TH>
                    <TH>SKU</TH>
                    <TH className="text-right">System</TH>
                    <TH className="text-right">Counted</TH>
                    <TH className="text-right">Difference</TH>
                  </TR>
                </THead>
                <TBody>
                  {adjustment.lines.length === 0 ? (
                    <EmptyRow colSpan={5}>This count has no lines.</EmptyRow>
                  ) : (
                    adjustment.lines.map((line) => (
                      <TR key={line.id}>
                        <TD className="font-medium">{line.name}</TD>
                        <TD className="tabular font-mono text-xs text-muted-foreground">
                          {line.sku}
                        </TD>
                        <TD className="tabular text-right text-muted-foreground">
                          {formatQty(line.systemQty)}
                        </TD>
                        <TD className="tabular text-right font-medium">
                          {formatQty(line.countedQty)}
                        </TD>
                        <TD
                          className={cn(
                            "tabular text-right font-semibold",
                            line.difference > 0 && "text-success",
                            line.difference < 0 && "text-danger",
                            line.difference === 0 && "text-muted-foreground",
                          )}
                        >
                          {line.difference > 0 ? "+" : ""}
                          {formatQty(line.difference)}
                        </TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>
            </TableShell>
          </Card>

          {adjustment.moves.length > 0 ? (
            <Card>
              <CardHeader
                title="Corrections written to the ledger"
                description="A surplus comes out of the adjustment location; a shortage goes back into it."
              />
              <TableShell className="rounded-none border-0">
                <Table>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Product</TH>
                      <TH>Direction</TH>
                      <TH className="text-right">Quantity</TH>
                      <TH>Recorded</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {adjustment.moves.map((move) => (
                      <TR key={move.id}>
                        <TD className="font-medium">{move.productName}</TD>
                        <TD
                          className={move.surplus ? "text-success" : "text-danger"}
                        >
                          {move.surplus ? "Surplus found" : "Shortage written off"}
                        </TD>
                        <TD className="tabular text-right">
                          {move.surplus ? "+" : "−"}
                          {formatQty(move.quantity, move.uom)}
                        </TD>
                        <TD className="tabular text-muted-foreground">
                          {formatDateTime(move.movedAt)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableShell>
            </Card>
          ) : null}
        </div>

        <Card className="h-fit">
          <CardHeader title="Summary" />
          <CardBody>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
                  Lines counted
                </dt>
                <dd className="tabular mt-0.5">{adjustment.lines.length}</dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
                  Lines differing
                </dt>
                <dd className="tabular mt-0.5">{corrections.length}</dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
                  Net surplus
                </dt>
                <dd className="tabular mt-0.5 text-success">+{formatQty(surplus)}</dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
                  Net shortage
                </dt>
                <dd className="tabular mt-0.5 text-danger">{formatQty(shortage)}</dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
                  Applied
                </dt>
                <dd className="tabular mt-0.5">
                  {adjustment.validatedAt ? formatDateTime(adjustment.validatedAt) : "Not yet"}
                </dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
                  Created by
                </dt>
                <dd className="mt-0.5">{adjustment.createdBy.name}</dd>
              </div>
              {adjustment.note ? (
                <div>
                  <dt className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
                    Note
                  </dt>
                  <dd className="mt-0.5 text-muted-foreground">{adjustment.note}</dd>
                </div>
              ) : null}
            </dl>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

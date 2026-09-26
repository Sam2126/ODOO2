import { DocStatus } from "@prisma/client";
import { ArrowRight, CircleDot } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { PickingConfig } from "@/components/documents/config";
import { PickingActions } from "@/components/documents/picking-actions";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { EmptyRow, TBody, TD, TH, THead, TR, Table, TableShell } from "@/components/ui/table";
import { formatDate, formatDateTime, formatQty } from "@/lib/utils";
import { getPicking } from "@/server/queries/documents";

/** Draft → Waiting/Ready → Done, shown as a strip so the state is obvious. */
const FLOW: DocStatus[] = [DocStatus.DRAFT, DocStatus.READY, DocStatus.DONE];

function StatusFlow({ status }: { status: DocStatus }) {
  if (status === DocStatus.CANCELED) return null;
  const current = status === DocStatus.WAITING ? DocStatus.DRAFT : status;
  const reached = FLOW.indexOf(current);

  return (
    <ol className="flex items-center gap-1.5 text-xs">
      {FLOW.map((step, index) => {
        const done = index <= reached;
        const label =
          step === DocStatus.READY && status === DocStatus.WAITING ? "Waiting" : step;
        return (
          <li key={step} className="flex items-center gap-1.5">
            <span
              className={
                done
                  ? "flex items-center gap-1 rounded-full bg-primary-subtle px-2 py-0.5 font-medium text-primary"
                  : "flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-muted-foreground"
              }
            >
              <CircleDot className="size-3" aria-hidden />
              {label.charAt(0) + label.slice(1).toLowerCase()}
            </span>
            {index < FLOW.length - 1 ? (
              <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export async function PickingDetailPage({
  config,
  id,
}: {
  config: PickingConfig;
  id: string;
}) {
  const document = await getPicking(id);
  if (!document || document.type !== config.type) notFound();

  const isDone = document.status === DocStatus.DONE;
  const totalDemand = document.lines.reduce((sum, line) => sum + line.demandQty, 0);
  const totalDone = document.lines.reduce((sum, line) => sum + line.doneQty, 0);

  return (
    <>
      <PageHeader
        title={document.reference}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={document.status} />
            <StatusFlow status={document.status} />
          </span>
        }
        actions={
          <ButtonLink href={config.route} variant="ghost">
            Back to {config.title.toLowerCase()}
          </ButtonLink>
        }
      />

      <PickingActions id={document.id} status={document.status} config={config} />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Products"
              description={
                isDone
                  ? "Done quantities are what moved into the ledger."
                  : "Done is what will move when this document is validated."
              }
            />
            <TableShell className="rounded-none border-0">
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Product</TH>
                    <TH>SKU</TH>
                    <TH className="text-right">Demand</TH>
                    <TH className="text-right">Done</TH>
                    <TH>Unit</TH>
                  </TR>
                </THead>
                <TBody>
                  {document.lines.length === 0 ? (
                    <EmptyRow colSpan={5}>
                      This document has no product lines yet.
                    </EmptyRow>
                  ) : (
                    document.lines.map((line) => (
                      <TR key={line.id}>
                        <TD className="font-medium">
                          <Link
                            href={`/products/${line.productId}`}
                            className="hover:text-primary hover:underline"
                          >
                            {line.name}
                          </Link>
                        </TD>
                        <TD className="tabular font-mono text-xs text-muted-foreground">
                          {line.sku}
                        </TD>
                        <TD className="tabular text-right">{formatQty(line.demandQty)}</TD>
                        <TD className="tabular text-right font-medium">
                          {formatQty(line.doneQty)}
                        </TD>
                        <TD className="text-xs text-muted-foreground">{line.uom}</TD>
                      </TR>
                    ))
                  )}
                </TBody>
                {document.lines.length > 0 ? (
                  <tfoot className="border-t border-border bg-surface-muted/50">
                    <tr>
                      <td className="px-4 py-2.5 text-sm font-medium" colSpan={2}>
                        {document.lines.length} line{document.lines.length === 1 ? "" : "s"}
                      </td>
                      <td className="tabular px-4 py-2.5 text-right text-sm">
                        {formatQty(totalDemand)}
                      </td>
                      <td className="tabular px-4 py-2.5 text-right text-sm font-semibold">
                        {formatQty(totalDone)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                ) : null}
              </Table>
            </TableShell>
          </Card>

          {document.moves.length > 0 ? (
            <Card>
              <CardHeader
                title="Stock movements"
                description={`Written when this document was validated. ${config.doneMessage}`}
              />
              <TableShell className="rounded-none border-0">
                <Table>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Product</TH>
                      <TH className="text-right">Quantity</TH>
                      <TH>From</TH>
                      <TH>To</TH>
                      <TH>Recorded</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {document.moves.map((move) => (
                      <TR key={move.id}>
                        <TD className="font-medium">{move.productName}</TD>
                        <TD className="tabular text-right">
                          {formatQty(move.quantity, move.uom)}
                        </TD>
                        <TD className="text-muted-foreground">{move.from}</TD>
                        <TD className="text-muted-foreground">{move.to}</TD>
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
          <CardHeader title="Details" />
          <CardBody>
            <dl className="space-y-4">
              {config.partnerLabel ? (
                <Detail label={config.partnerLabel}>{document.partnerName ?? "—"}</Detail>
              ) : null}
              <Detail label="Warehouse">{document.warehouse.name}</Detail>
              <Detail label={config.sourceLabel}>{document.sourceLocation.name}</Detail>
              <Detail label={config.destLabel}>{document.destLocation.name}</Detail>
              <Detail label="Scheduled">{formatDate(document.scheduledAt)}</Detail>
              <Detail label="Validated">
                {document.validatedAt ? formatDateTime(document.validatedAt) : "Not yet"}
              </Detail>
              <Detail label="Created by">{document.createdBy.name}</Detail>
              {document.note ? (
                <Detail label="Note">
                  <span className="text-muted-foreground">{document.note}</span>
                </Detail>
              ) : null}
            </dl>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

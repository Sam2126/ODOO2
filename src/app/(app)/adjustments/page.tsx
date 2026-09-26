import { ClipboardCheck, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FilterBar, FilterSelect, SearchInput } from "@/components/filters";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { EmptyRow, TBody, TD, TH, THead, TR, Table, TableShell } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { listAdjustments, listWarehousesWithLocations } from "@/server/queries/documents";

export const metadata: Metadata = { title: "Inventory adjustments" };

const one = (value: string | string[] | undefined) =>
  typeof value === "string" && value !== "" ? value : undefined;

export default async function AdjustmentsPage({ searchParams }: PageProps<"/adjustments">) {
  const params = await searchParams;

  const filters = {
    status: one(params.status),
    warehouseId: one(params.warehouse),
    search: one(params.q),
  };

  const [adjustments, warehouses] = await Promise.all([
    listAdjustments(filters),
    listWarehousesWithLocations(),
  ]);

  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="Inventory adjustments"
        description="Reconcile what the system believes with what is physically on the shelf."
        actions={
          <ButtonLink href="/adjustments/new">
            <Plus aria-hidden />
            New count
          </ButtonLink>
        }
      />

      <FilterBar activeCount={activeFilters} basePath="/adjustments">
        <SearchInput placeholder="Reference…" className="w-full sm:w-64" />
        <FilterSelect
          name="status"
          label="Status"
          allLabel="Any status"
          options={[
            { value: "DRAFT", label: "Draft" },
            { value: "DONE", label: "Applied" },
            { value: "CANCELED", label: "Canceled" },
          ]}
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
      </FilterBar>

      {adjustments.length === 0 && activeFilters === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardCheck}
            title="No counts recorded yet"
            description="Pick a location, enter the counted quantities, and StockSense writes the difference to the ledger."
            action={
              <ButtonLink href="/adjustments/new" size="sm">
                <Plus aria-hidden />
                New count
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <TableShell>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Reference</TH>
                <TH>Location</TH>
                <TH>Warehouse</TH>
                <TH className="text-right">Lines</TH>
                <TH>Created</TH>
                <TH>Applied</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {adjustments.length === 0 ? (
                <EmptyRow colSpan={7}>Nothing matches these filters.</EmptyRow>
              ) : (
                adjustments.map((adjustment) => (
                  <TR key={adjustment.id}>
                    <TD>
                      <Link
                        href={`/adjustments/${adjustment.id}`}
                        className="tabular font-mono text-[0.8125rem] font-medium text-primary hover:underline"
                      >
                        {adjustment.reference}
                      </Link>
                    </TD>
                    <TD className="font-medium">{adjustment.location.name}</TD>
                    <TD className="text-muted-foreground">
                      {adjustment.location.warehouse?.name ?? "—"}
                    </TD>
                    <TD className="tabular text-right text-muted-foreground">
                      {adjustment.lineCount}
                    </TD>
                    <TD className="tabular text-muted-foreground">
                      {formatDate(adjustment.createdAt)}
                    </TD>
                    <TD className="tabular text-muted-foreground">
                      {adjustment.validatedAt ? formatDate(adjustment.validatedAt) : "—"}
                    </TD>
                    <TD>
                      <StatusBadge status={adjustment.status} />
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </TableShell>
      )}
    </>
  );
}

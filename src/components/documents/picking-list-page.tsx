import { Plus } from "lucide-react";
import Link from "next/link";

import type { PickingConfig } from "@/components/documents/config";
import { FilterBar, FilterSelect, SearchInput } from "@/components/filters";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { EmptyRow, TBody, TD, TH, THead, TR, Table, TableShell } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { listPickings, listWarehousesWithLocations } from "@/server/queries/documents";

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "WAITING", label: "Waiting" },
  { value: "READY", label: "Ready" },
  { value: "DONE", label: "Done" },
  { value: "CANCELED", label: "Canceled" },
];

export async function PickingListPage({
  config,
  searchParams,
}: {
  config: PickingConfig;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const one = (value: string | string[] | undefined) =>
    typeof value === "string" && value !== "" ? value : undefined;

  const filters = {
    status: one(searchParams.status),
    warehouseId: one(searchParams.warehouse),
    search: one(searchParams.q),
  };

  const [documents, warehouses] = await Promise.all([
    listPickings(config.type, filters),
    listWarehousesWithLocations(),
  ]);

  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <ButtonLink href={`${config.route}/new`}>
            <Plus aria-hidden />
            New {config.singular.toLowerCase()}
          </ButtonLink>
        }
      />

      <FilterBar activeCount={activeFilters} basePath={config.route}>
        <SearchInput
          placeholder={
            config.partnerLabel
              ? `Reference or ${config.partnerLabel.toLowerCase()}…`
              : "Reference…"
          }
          className="w-full sm:w-72"
        />
        <FilterSelect
          name="status"
          label="Status"
          allLabel="Any status"
          options={STATUS_OPTIONS}
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

      {documents.length === 0 && activeFilters === 0 ? (
        <Card>
          <EmptyState
            title={config.emptyTitle}
            description={config.emptyBody}
            action={
              <ButtonLink href={`${config.route}/new`} size="sm">
                <Plus aria-hidden />
                New {config.singular.toLowerCase()}
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
                {config.partnerLabel ? <TH>{config.partnerLabel}</TH> : null}
                <TH>From</TH>
                <TH>To</TH>
                <TH>Warehouse</TH>
                <TH className="text-right">Lines</TH>
                <TH>Scheduled</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {documents.length === 0 ? (
                <EmptyRow colSpan={config.partnerLabel ? 8 : 7}>
                  Nothing matches these filters.
                </EmptyRow>
              ) : (
                documents.map((document) => (
                  <TR key={document.id}>
                    <TD>
                      <Link
                        href={`${config.route}/${document.id}`}
                        className="tabular font-mono text-[0.8125rem] font-medium text-accent hover:underline"
                      >
                        {document.reference}
                      </Link>
                    </TD>
                    {config.partnerLabel ? (
                      <TD className="max-w-48 truncate">{document.partnerName ?? "—"}</TD>
                    ) : null}
                    <TD className="text-muted-foreground">{document.sourceLocation.name}</TD>
                    <TD className="text-muted-foreground">{document.destLocation.name}</TD>
                    <TD className="text-muted-foreground">{document.warehouse.name}</TD>
                    <TD className="tabular text-right text-muted-foreground">
                      {document.lineCount}
                    </TD>
                    <TD className="tabular text-muted-foreground">
                      {formatDate(document.scheduledAt)}
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
      )}
    </>
  );
}

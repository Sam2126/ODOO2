"use client";

import type { LocationType } from "@prisma/client";
import { useActionState, useMemo, useState } from "react";

import {
  PickingLineEditor,
  type PickingLineDraft,
  type ProductOption,
} from "@/components/documents/line-editor";
import type { PickingConfig } from "@/components/documents/config";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { LOCATION_TYPE } from "@/lib/enums";
import { initialFormState } from "@/lib/form-state";
import { toDateInputValue } from "@/lib/utils";
import { createPickingAction, updatePickingAction } from "@/server/actions/pickings";

export type WarehouseOption = {
  id: string;
  name: string;
  code: string;
  locations: { id: string; name: string; code: string }[];
};

export type VirtualLocationOption = {
  id: string;
  name: string;
  type: LocationType;
};

type PickingFormProps = {
  config: PickingConfig;
  warehouses: WarehouseOption[];
  virtualLocations: VirtualLocationOption[];
  products: ProductOption[];
  /** Absent when creating. */
  document?: {
    id: string;
    warehouseId: string;
    sourceLocationId: string;
    destLocationId: string;
    partnerName: string | null;
    scheduledAt: Date;
    note: string | null;
    lines: PickingLineDraft[];
  };
  readOnly?: boolean;
};

export function PickingForm({
  config,
  warehouses,
  virtualLocations,
  products,
  document,
  readOnly,
}: PickingFormProps) {
  const isEdit = Boolean(document);
  const [state, formAction] = useActionState(
    isEdit ? updatePickingAction : createPickingAction,
    initialFormState,
  );

  const [warehouseId, setWarehouseId] = useState(
    document?.warehouseId ?? warehouses[0]?.id ?? "",
  );

  const locations = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === warehouseId)?.locations ?? [],
    [warehouses, warehouseId],
  );

  const vendorLocation = virtualLocations.find((l) => l.type === LOCATION_TYPE.VENDOR);
  const customerLocation = virtualLocations.find((l) => l.type === LOCATION_TYPE.CUSTOMER);

  // Defaults aim at the most common case: a warehouse's own stock location.
  const defaultInternal = locations[0]?.id ?? "";
  const [sourceLocationId, setSourceLocationId] = useState(
    document?.sourceLocationId ??
      (config.sourceMode === "virtual-vendor" ? (vendorLocation?.id ?? "") : defaultInternal),
  );
  const [destLocationId, setDestLocationId] = useState(
    document?.destLocationId ??
      (config.destMode === "virtual-customer" ? (customerLocation?.id ?? "") : defaultInternal),
  );

  function onWarehouseChange(nextId: string) {
    setWarehouseId(nextId);
    const next = warehouses.find((warehouse) => warehouse.id === nextId);
    const first = next?.locations[0]?.id ?? "";
    // Locations belong to a warehouse, so a warehouse change invalidates them.
    if (config.sourceMode === "internal") setSourceLocationId(first);
    if (config.destMode === "internal") setDestLocationId(first);
  }

  const locationOptions = locations.map((location) => (
    <option key={location.id} value={location.id}>
      {location.name}
    </option>
  ));

  // An internal transfer may deliver into another warehouse — the problem
  // statement lists "Warehouse 1 to Warehouse 2" — so its destination offers
  // every warehouse, grouped, while the source stays inside this one.
  const allLocationOptions = warehouses.map((warehouse) => (
    <optgroup key={warehouse.id} label={warehouse.name}>
      {warehouse.locations.map((location) => (
        <option key={location.id} value={location.id}>
          {location.name}
        </option>
      ))}
    </optgroup>
  ));

  const crossWarehouse =
    config.type === "INTERNAL" &&
    Boolean(destLocationId) &&
    !locations.some((location) => location.id === destLocationId);

  return (
    <form action={formAction} className="space-y-5">
      {isEdit ? <input type="hidden" name="id" value={document!.id} /> : null}
      <input type="hidden" name="type" value={config.type} />
      <input type="hidden" name="sourceLocationId" value={sourceLocationId} />
      <input type="hidden" name="destLocationId" value={destLocationId} />

      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}
      {state.status === "success" && state.message ? (
        <Alert tone="success">{state.message}</Alert>
      ) : null}

      <Card>
        <CardHeader title={`${config.singular} details`} />
        <CardBody className="grid gap-x-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Warehouse" htmlFor="warehouseId" required>
            <Select
              id="warehouseId"
              name="warehouseId"
              value={warehouseId}
              disabled={readOnly}
              onChange={(event) => onWarehouseChange(event.target.value)}
            >
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </Select>
          </Field>

          {config.partnerLabel ? (
            <Field
              label={config.partnerLabel}
              htmlFor="partnerName"
              error={state.fieldErrors?.partnerName}
            >
              <Input
                id="partnerName"
                name="partnerName"
                defaultValue={document?.partnerName ?? ""}
                placeholder={config.partnerPlaceholder}
                disabled={readOnly}
              />
            </Field>
          ) : null}

          <Field
            label="Scheduled date"
            htmlFor="scheduledAt"
            error={state.fieldErrors?.scheduledAt}
            required
          >
            <Input
              id="scheduledAt"
              name="scheduledAt"
              type="date"
              defaultValue={toDateInputValue(document?.scheduledAt ?? new Date())}
              disabled={readOnly}
            />
          </Field>

          <Field
            label={config.sourceLabel}
            htmlFor="sourceSelect"
            error={state.fieldErrors?.sourceLocationId}
            hint={
              config.sourceMode === "virtual-vendor"
                ? "Incoming goods always come from the vendor location."
                : undefined
            }
            required
          >
            {config.sourceMode === "virtual-vendor" ? (
              <Input id="sourceSelect" value={vendorLocation?.name ?? "—"} disabled readOnly />
            ) : (
              <Select
                id="sourceSelect"
                value={sourceLocationId}
                disabled={readOnly}
                onChange={(event) => setSourceLocationId(event.target.value)}
              >
                {locationOptions}
              </Select>
            )}
          </Field>

          <Field
            label={config.destLabel}
            htmlFor="destSelect"
            error={state.fieldErrors?.destLocationId}
            hint={
              config.destMode === "virtual-customer"
                ? "Outgoing goods always go to the customer location."
                : crossWarehouse
                  ? "Moving into another warehouse. Total stock is unchanged."
                  : config.type === "INTERNAL"
                    ? "Any location, including another warehouse."
                    : undefined
            }
            required
          >
            {config.destMode === "virtual-customer" ? (
              <Input id="destSelect" value={customerLocation?.name ?? "—"} disabled readOnly />
            ) : (
              <Select
                id="destSelect"
                value={destLocationId}
                disabled={readOnly}
                onChange={(event) => setDestLocationId(event.target.value)}
              >
                {config.type === "INTERNAL" ? allLocationOptions : locationOptions}
              </Select>
            )}
          </Field>

          <Field label="Note" htmlFor="note" className="sm:col-span-2 lg:col-span-3">
            <Textarea
              id="note"
              name="note"
              rows={2}
              defaultValue={document?.note ?? ""}
              placeholder="Anything the next person handling this should know."
              disabled={readOnly}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Products"
          description="Demand is what was ordered. Done is what actually moves when you validate."
        />
        <CardBody>
          <PickingLineEditor
            products={products}
            initialLines={document?.lines ?? []}
            disabled={readOnly}
          />
        </CardBody>
      </Card>

      {readOnly ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton pendingLabel="Saving…">
            {isEdit ? "Save changes" : `Create ${config.singular.toLowerCase()}`}
          </SubmitButton>
          <ButtonLink
            href={isEdit ? `${config.route}/${document!.id}` : config.route}
            variant="ghost"
          >
            Cancel
          </ButtonLink>
        </div>
      )}
    </form>
  );
}

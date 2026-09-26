"use client";

import { Plus, Trash2, Warehouse as WarehouseIcon } from "lucide-react";
import { useActionState, useState } from "react";

import { ActionButton, ActionGroup } from "@/components/action-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/form-state";
import { formatQty } from "@/lib/utils";
import {
  deleteLocationAction,
  deleteWarehouseAction,
  saveLocationAction,
  saveWarehouseAction,
} from "@/server/actions/settings";

export type WarehouseRow = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  locations: {
    id: string;
    name: string;
    code: string;
    units: number;
    products: number;
  }[];
};

function AddLocationForm({ warehouseId, code }: { warehouseId: string; code: string }) {
  const [state, formAction] = useActionState(saveLocationAction, initialFormState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Add location
      </Button>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-2">
      <input type="hidden" name="warehouseId" value={warehouseId} />
      <input type="hidden" name="type" value="INTERNAL" />

      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <Field
          label="Name"
          htmlFor={`loc-name-${warehouseId}`}
          error={state.fieldErrors?.name}
          className="min-w-44 flex-1"
        >
          <Input
            id={`loc-name-${warehouseId}`}
            name="name"
            placeholder={`${code}/Rack-C`}
            required
            className="h-8 text-[0.8125rem]"
          />
        </Field>
        <Field
          label="Code"
          htmlFor={`loc-code-${warehouseId}`}
          error={state.fieldErrors?.code}
          className="w-32"
        >
          <Input
            id={`loc-code-${warehouseId}`}
            name="code"
            placeholder="RACK-C"
            required
            className="tabular h-8 font-mono text-[0.8125rem]"
          />
        </Field>
        <div className="mb-5 flex gap-2">
          <SubmitButton size="sm" pendingLabel="Adding…">
            Add
          </SubmitButton>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}

function NewWarehouseForm() {
  const [state, formAction] = useActionState(saveWarehouseAction, initialFormState);

  return (
    <Card>
      <CardHeader
        title="Add a warehouse"
        description="A new warehouse comes with its own stock location ready to use."
      />
      <CardBody>
        <form action={formAction} className="space-y-3">
          {state.message ? (
            <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>
          ) : null}

          <div className="grid gap-x-4 sm:grid-cols-3">
            <Field label="Name" htmlFor="wh-name" error={state.fieldErrors?.name} required>
              <Input id="wh-name" name="name" placeholder="Pune Warehouse" required />
            </Field>
            <Field
              label="Code"
              htmlFor="wh-code"
              error={state.fieldErrors?.code}
              hint="Becomes the document prefix: WH3/IN/00001."
              required
            >
              <Input
                id="wh-code"
                name="code"
                placeholder="WH3"
                required
                maxLength={8}
                className="tabular font-mono"
              />
            </Field>
            <Field label="Address" htmlFor="wh-address" error={state.fieldErrors?.address}>
              <Input id="wh-address" name="address" placeholder="Chakan MIDC, Pune" />
            </Field>
          </div>

          <SubmitButton pendingLabel="Creating…">
            <Plus aria-hidden />
            Create warehouse
          </SubmitButton>
        </form>
      </CardBody>
    </Card>
  );
}

export function WarehouseManager({ warehouses }: { warehouses: WarehouseRow[] }) {
  return (
    <div className="space-y-5">
      {warehouses.map((warehouse) => (
        <Card key={warehouse.id}>
          <CardHeader
            title={
              <span className="flex flex-wrap items-center gap-2">
                <WarehouseIcon className="size-4 text-muted-foreground" aria-hidden />
                {warehouse.name}
                <span className="tabular rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                  {warehouse.code}
                </span>
              </span>
            }
            description={warehouse.address ?? "No address recorded."}
            action={
              <ActionGroup>
                <ActionButton
                  action={deleteWarehouseAction}
                  id={warehouse.id}
                  variant="ghost"
                  size="sm"
                  confirm="Confirm delete"
                  className="text-danger hover:bg-danger-subtle"
                >
                  <Trash2 aria-hidden />
                  Delete
                </ActionButton>
              </ActionGroup>
            }
          />
          <CardBody className="space-y-3">
            <ul className="divide-y divide-border rounded-md border border-border">
              {warehouse.locations.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No locations yet.
                </li>
              ) : (
                warehouse.locations.map((location) => (
                  <li
                    key={location.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{location.name}</p>
                      <p className="tabular font-mono text-xs text-muted-foreground">
                        {location.code}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="tabular text-right text-xs text-muted-foreground">
                        <span className="block text-sm font-medium text-foreground">
                          {formatQty(location.units)}
                        </span>
                        {location.products} product{location.products === 1 ? "" : "s"}
                      </p>
                      <ActionGroup>
                        <ActionButton
                          action={deleteLocationAction}
                          id={location.id}
                          variant="ghost"
                          size="sm"
                          confirm="Confirm delete"
                          className="text-danger hover:bg-danger-subtle"
                        >
                          <Trash2 aria-hidden />
                          <span className="sr-only">Delete {location.name}</span>
                        </ActionButton>
                      </ActionGroup>
                    </div>
                  </li>
                ))
              )}
            </ul>

            <AddLocationForm warehouseId={warehouse.id} code={warehouse.code} />
          </CardBody>
        </Card>
      ))}

      <NewWarehouseForm />
    </div>
  );
}

"use client";

import type { Uom } from "@prisma/client";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { UOM, UOM_VALUES } from "@/lib/enums";
import { initialFormState } from "@/lib/form-state";
import { uomLabel } from "@/lib/utils";
import { createProductAction, updateProductAction } from "@/server/actions/products";

export type ProductFormValues = {
  id: string;
  name: string;
  sku: string;
  uom: Uom;
  categoryId: string | null;
  costPrice: number | null;
  salePrice: number | null;
  isActive: boolean;
};

export function ProductForm({
  categories,
  locations,
  product,
}: {
  categories: { id: string; name: string }[];
  /** Only offered when creating — an opening balance needs somewhere to land. */
  locations: { id: string; name: string; warehouseName: string }[];
  product?: ProductFormValues;
}) {
  const isEdit = Boolean(product);
  const [state, formAction] = useActionState(
    isEdit ? updateProductAction : createProductAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="space-y-5">
      {isEdit ? <input type="hidden" name="id" value={product!.id} /> : null}

      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}
      {state.status === "success" && state.message ? (
        <Alert tone="success">{state.message}</Alert>
      ) : null}

      <Card>
        <CardHeader title="Product details" />
        <CardBody className="grid gap-x-5 sm:grid-cols-2">
          <Field
            label="Name"
            htmlFor="name"
            error={state.fieldErrors?.name}
            required
            className="sm:col-span-2"
          >
            <Input
              id="name"
              name="name"
              defaultValue={product?.name}
              placeholder="Steel Rod 12mm"
              required
              invalid={Boolean(state.fieldErrors?.name)}
            />
          </Field>

          <Field
            label="SKU"
            htmlFor="sku"
            error={state.fieldErrors?.sku}
            hint="Stored uppercase. Used for search and on every document."
            required
          >
            <Input
              id="sku"
              name="sku"
              defaultValue={product?.sku}
              placeholder="STL-ROD-12"
              required
              className="tabular font-mono"
              invalid={Boolean(state.fieldErrors?.sku)}
            />
          </Field>

          <Field label="Unit of measure" htmlFor="uom" error={state.fieldErrors?.uom}>
            <Select id="uom" name="uom" defaultValue={product?.uom ?? UOM.UNIT}>
              {UOM_VALUES.map((uom) => (
                <option key={uom} value={uom}>
                  {uomLabel(uom)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Category" htmlFor="categoryId" error={state.fieldErrors?.categoryId}>
            <Select
              id="categoryId"
              name="categoryId"
              defaultValue={product?.categoryId ?? ""}
            >
              <option value="">Uncategorised</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Cost price"
            htmlFor="costPrice"
            error={state.fieldErrors?.costPrice}
            hint="Optional."
          >
            <Input
              id="costPrice"
              name="costPrice"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              defaultValue={product?.costPrice ?? ""}
              className="tabular"
            />
          </Field>

          <Field
            label="Sale price"
            htmlFor="salePrice"
            error={state.fieldErrors?.salePrice}
            hint="Optional."
          >
            <Input
              id="salePrice"
              name="salePrice"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              defaultValue={product?.salePrice ?? ""}
              className="tabular"
            />
          </Field>

          <label className="flex items-center gap-2.5 self-start pt-1 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={product?.isActive ?? true}
              className="size-4 rounded border-border accent-[var(--primary)]"
            />
            <span>
              Active
              <span className="block text-xs text-muted-foreground">
                Archived products stay on past documents but cannot be added to new ones.
              </span>
            </span>
          </label>
        </CardBody>
      </Card>

      {!isEdit ? (
        <Card>
          <CardHeader
            title="Opening stock"
            description="Optional. Booked as a real movement, so the ledger explains where it came from."
          />
          <CardBody className="grid gap-x-5 sm:grid-cols-2">
            <Field label="Location" htmlFor="openingLocationId">
              <Select id="openingLocationId" name="openingLocationId" defaultValue="">
                <option value="">Do not add opening stock</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} — {location.warehouseName}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Quantity"
              htmlFor="openingQty"
              error={state.fieldErrors?.quantity}
              hint="Leave blank for none."
            >
              <Input
                id="openingQty"
                name="openingQty"
                type="number"
                min={0}
                step="0.001"
                inputMode="decimal"
                placeholder="0"
                className="tabular"
              />
            </Field>
          </CardBody>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton pendingLabel="Saving…">
          {isEdit ? "Save changes" : "Create product"}
        </SubmitButton>
        <ButtonLink
          href={isEdit ? `/products/${product!.id}` : "/products"}
          variant="ghost"
        >
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}

"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState } from "react";

import { ActionButton, ActionGroup } from "@/components/action-button";
import { Alert } from "@/components/ui/alert";
import { Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/form-state";
import { formatQty } from "@/lib/utils";
import { deleteReorderRuleAction, saveReorderRuleAction } from "@/server/actions/products";

export type ReorderRuleRow = {
  id: string;
  warehouseId: string;
  warehouseName: string;
  minQty: number;
  maxQty: number;
  onHand: number;
};

export function ReorderRules({
  productId,
  rules,
  warehouses,
}: {
  productId: string;
  rules: ReorderRuleRow[];
  warehouses: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(saveReorderRuleAction, initialFormState);

  // One rule per warehouse, so a warehouse that already has one is not offered.
  const covered = new Set(rules.map((rule) => rule.warehouseId));
  const available = warehouses.filter((warehouse) => !covered.has(warehouse.id));

  return (
    <div className="space-y-4">
      {state.message ? (
        <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>
      ) : null}

      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No reordering rules yet. Set a minimum and this product will appear in the low-stock
          alerts as soon as it drops below it.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {rules.map((rule) => {
            const short = rule.onHand <= rule.minQty;
            return (
              <li
                key={rule.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {rule.warehouseName}
                    {short ? (
                      <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-[0.6875rem] font-semibold text-warning">
                        Low stock
                      </span>
                    ) : null}
                  </p>
                  <p className="tabular mt-0.5 text-xs text-muted-foreground">
                    min {formatQty(rule.minQty)} · max {formatQty(rule.maxQty)} · on hand{" "}
                    <span className={short ? "font-semibold text-warning" : undefined}>
                      {formatQty(rule.onHand)}
                    </span>
                  </p>
                </div>
                <ActionGroup>
                  <ActionButton
                    action={deleteReorderRuleAction}
                    id={rule.id}
                    variant="ghost"
                    size="sm"
                    confirm="Confirm remove"
                    className="text-danger hover:bg-danger-subtle"
                  >
                    <Trash2 aria-hidden />
                    Remove
                  </ActionButton>
                </ActionGroup>
              </li>
            );
          })}
        </ul>
      )}

      {available.length > 0 ? (
        <form
          action={formAction}
          className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3"
        >
          <input type="hidden" name="productId" value={productId} />

          <label className="flex min-w-40 flex-1 flex-col gap-1">
            <span className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
              Warehouse
            </span>
            <Select name="warehouseId" required className="h-8 text-[0.8125rem]">
              {available.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex w-28 flex-col gap-1">
            <span className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
              Minimum
            </span>
            <Input
              name="minQty"
              type="number"
              min={0}
              step="0.001"
              defaultValue={0}
              className="tabular h-8 text-right text-[0.8125rem]"
              invalid={Boolean(state.fieldErrors?.minQty)}
            />
          </label>

          <label className="flex w-28 flex-col gap-1">
            <span className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
              Maximum
            </span>
            <Input
              name="maxQty"
              type="number"
              min={0}
              step="0.001"
              defaultValue={0}
              className="tabular h-8 text-right text-[0.8125rem]"
              invalid={Boolean(state.fieldErrors?.maxQty)}
            />
          </label>

          <SubmitButton size="sm" variant="secondary" pendingLabel="Saving…">
            <Plus aria-hidden />
            Add rule
          </SubmitButton>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">
          Every warehouse already has a rule for this product.
        </p>
      )}
    </div>
  );
}

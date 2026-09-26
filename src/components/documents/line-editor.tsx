"use client";

import { Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn, formatQty } from "@/lib/utils";

export type ProductOption = {
  id: string;
  name: string;
  sku: string;
  uom: string;
};

export type PickingLineDraft = {
  productId: string;
  name: string;
  sku: string;
  uom: string;
  demandQty: number;
  doneQty: number;
};

export type AdjustmentLineDraft = {
  productId: string;
  name: string;
  sku: string;
  uom: string;
  systemQty: number;
  countedQty: number;
};

/**
 * Add-a-product control shared by both editors.
 *
 * A plain <select> of every product is unusable past a few dozen SKUs, and the
 * problem statement explicitly asks for SKU search — so this filters on both
 * name and SKU and hides products already on the document.
 */
function ProductPicker({
  products,
  exclude,
  onPick,
  disabled,
}: {
  products: ProductOption[];
  exclude: Set<string>;
  onPick: (product: ProductOption) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const available = products.filter((product) => !exclude.has(product.id));
    const needle = query.trim().toLowerCase();
    if (!needle) return available.slice(0, 8);
    return available
      .filter(
        (product) =>
          product.name.toLowerCase().includes(needle) ||
          product.sku.toLowerCase().includes(needle),
      )
      .slice(0, 8);
  }, [products, exclude, query]);

  if (disabled) return null;

  return (
    <div className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          placeholder="Add a product by name or SKU…"
          className="pl-9"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // A click on a suggestion must land before the list closes.
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>

      {open && matches.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg">
          {matches.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-muted"
                onClick={() => {
                  onPick(product);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="min-w-0 truncate">{product.name}</span>
                <span className="tabular shrink-0 font-mono text-xs text-muted-foreground">
                  {product.sku}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {open && query.trim() && matches.length === 0 ? (
        <p className="absolute z-20 mt-1 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-muted-foreground shadow-lg">
          No product matches “{query.trim()}”.
        </p>
      ) : null}
    </div>
  );
}

const headerCell =
  "px-3 py-2 text-left text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase";

function QtyInput({
  value,
  onChange,
  disabled,
  invalid,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  invalid?: boolean;
  label: string;
}) {
  return (
    <Input
      type="number"
      min={0}
      step="0.001"
      inputMode="decimal"
      aria-label={label}
      value={Number.isNaN(value) ? "" : value}
      disabled={disabled}
      invalid={invalid}
      onChange={(event) => onChange(event.target.valueAsNumber)}
      className="tabular h-8 w-28 text-right"
    />
  );
}

export function PickingLineEditor({
  products,
  initialLines,
  disabled,
  showDone = true,
}: {
  products: ProductOption[];
  initialLines: PickingLineDraft[];
  disabled?: boolean;
  showDone?: boolean;
}) {
  const [lines, setLines] = useState<PickingLineDraft[]>(initialLines);
  const chosen = new Set(lines.map((line) => line.productId));

  const update = (productId: string, patch: Partial<PickingLineDraft>) =>
    setLines((current) =>
      current.map((line) => (line.productId === productId ? { ...line, ...patch } : line)),
    );

  const payload = lines.map((line) => ({
    productId: line.productId,
    demandQty: line.demandQty,
    doneQty: showDone ? line.doneQty : line.demandQty,
  }));

  return (
    <div className="space-y-3">
      <input type="hidden" name="lines" value={JSON.stringify(payload)} />

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="border-b border-border bg-surface-muted/60">
              <tr>
                <th className={headerCell}>Product</th>
                <th className={cn(headerCell, "w-32 text-right")}>Demand</th>
                {showDone ? <th className={cn(headerCell, "w-32 text-right")}>Done</th> : null}
                <th className={cn(headerCell, "w-20")}>Unit</th>
                {disabled ? null : <th className="w-12" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.length === 0 ? (
                <tr>
                  <td
                    colSpan={disabled ? 4 : 5}
                    className="px-3 py-10 text-center text-sm text-muted-foreground"
                  >
                    No products yet. Search below to add the first one.
                  </td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr key={line.productId}>
                    <td className="px-3 py-2">
                      <span className="block font-medium">{line.name}</span>
                      <span className="tabular block font-mono text-xs text-muted-foreground">
                        {line.sku}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <QtyInput
                        label={`Demand quantity for ${line.name}`}
                        value={line.demandQty}
                        disabled={disabled}
                        invalid={!(line.demandQty > 0)}
                        onChange={(value) =>
                          update(line.productId, {
                            demandQty: value,
                            // Keep done in step until it is edited on its own.
                            doneQty: line.doneQty === line.demandQty ? value : line.doneQty,
                          })
                        }
                      />
                    </td>
                    {showDone ? (
                      <td className="px-3 py-2 text-right">
                        <QtyInput
                          label={`Done quantity for ${line.name}`}
                          value={line.doneQty}
                          disabled={disabled}
                          onChange={(value) => update(line.productId, { doneQty: value })}
                        />
                      </td>
                    ) : null}
                    <td className="px-3 py-2 text-xs text-muted-foreground">{line.uom}</td>
                    {disabled ? null : (
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 hover:text-danger"
                          onClick={() =>
                            setLines((current) =>
                              current.filter((item) => item.productId !== line.productId),
                            )
                          }
                        >
                          <Trash2 aria-hidden />
                          <span className="sr-only">Remove {line.name}</span>
                        </Button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProductPicker
        products={products}
        exclude={chosen}
        disabled={disabled}
        onPick={(product) =>
          setLines((current) => [
            ...current,
            {
              productId: product.id,
              name: product.name,
              sku: product.sku,
              uom: product.uom,
              demandQty: 1,
              doneQty: 1,
            },
          ])
        }
      />
    </div>
  );
}

export function AdjustmentLineEditor({
  products,
  initialLines,
  disabled,
}: {
  products: ProductOption[];
  initialLines: AdjustmentLineDraft[];
  disabled?: boolean;
}) {
  const [lines, setLines] = useState<AdjustmentLineDraft[]>(initialLines);
  const chosen = new Set(lines.map((line) => line.productId));

  const payload = lines.map((line) => ({
    productId: line.productId,
    countedQty: line.countedQty,
  }));

  return (
    <div className="space-y-3">
      <input type="hidden" name="lines" value={JSON.stringify(payload)} />

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="border-b border-border bg-surface-muted/60">
              <tr>
                <th className={headerCell}>Product</th>
                <th className={cn(headerCell, "w-32 text-right")}>System</th>
                <th className={cn(headerCell, "w-32 text-right")}>Counted</th>
                <th className={cn(headerCell, "w-28 text-right")}>Difference</th>
                {disabled ? null : <th className="w-12" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.length === 0 ? (
                <tr>
                  <td
                    colSpan={disabled ? 4 : 5}
                    className="px-3 py-10 text-center text-sm text-muted-foreground"
                  >
                    Nothing to count yet. Pick a location above, or add products below.
                  </td>
                </tr>
              ) : (
                lines.map((line) => {
                  const difference = (line.countedQty || 0) - line.systemQty;
                  return (
                    <tr key={line.productId}>
                      <td className="px-3 py-2">
                        <span className="block font-medium">{line.name}</span>
                        <span className="tabular block font-mono text-xs text-muted-foreground">
                          {line.sku}
                        </span>
                      </td>
                      <td className="tabular px-3 py-2 text-right text-muted-foreground">
                        {formatQty(line.systemQty)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <QtyInput
                          label={`Counted quantity for ${line.name}`}
                          value={line.countedQty}
                          disabled={disabled}
                          onChange={(value) =>
                            setLines((current) =>
                              current.map((item) =>
                                item.productId === line.productId
                                  ? { ...item, countedQty: value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </td>
                      <td
                        className={cn(
                          "tabular px-3 py-2 text-right font-medium",
                          difference > 0 && "text-success",
                          difference < 0 && "text-danger",
                          difference === 0 && "text-muted-foreground",
                        )}
                      >
                        {difference > 0 ? "+" : ""}
                        {formatQty(difference)}
                      </td>
                      {disabled ? null : (
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 hover:text-danger"
                            onClick={() =>
                              setLines((current) =>
                                current.filter((item) => item.productId !== line.productId),
                              )
                            }
                          >
                            <Trash2 aria-hidden />
                            <span className="sr-only">Remove {line.name}</span>
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProductPicker
        products={products}
        exclude={chosen}
        disabled={disabled}
        onPick={(product) =>
          setLines((current) => [
            ...current,
            {
              productId: product.id,
              name: product.name,
              sku: product.sku,
              uom: product.uom,
              // A product not already in this location counts as zero on hand.
              systemQty: 0,
              countedQty: 0,
            },
          ])
        }
      />

      {lines.length > 0 && !disabled ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Plus className="size-3" aria-hidden />
          System quantities are read again when you apply the count, so a movement in the
          meantime cannot be overwritten silently.
        </p>
      ) : null}
    </div>
  );
}

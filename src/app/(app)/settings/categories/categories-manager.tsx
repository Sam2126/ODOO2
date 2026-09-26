"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { ActionButton, ActionGroup } from "@/components/action-button";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/form-state";
import { deleteCategoryAction, saveCategoryAction } from "@/server/actions/settings";

export type CategoryRow = { id: string; name: string; productCount: number };

export function CategoriesManager({ categories }: { categories: CategoryRow[] }) {
  const [state, formAction] = useActionState(saveCategoryAction, initialFormState);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader
          title="Categories"
          description="Used to group products and to filter the dashboard and product list."
        />
        <ul className="divide-y divide-border">
          {categories.length === 0 ? (
            <li className="px-5 py-10 text-center text-sm text-muted-foreground">
              No categories yet. Add the first one on the right.
            </li>
          ) : (
            categories.map((category) => (
              <li
                key={category.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{category.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {category.productCount === 0 ? (
                      "No products"
                    ) : (
                      <Link
                        href={`/products?category=${category.id}`}
                        className="hover:text-foreground hover:underline"
                      >
                        {category.productCount} product
                        {category.productCount === 1 ? "" : "s"}
                      </Link>
                    )}
                  </p>
                </div>
                <ActionGroup>
                  <ActionButton
                    action={deleteCategoryAction}
                    id={category.id}
                    variant="ghost"
                    size="sm"
                    confirm="Confirm delete"
                    className="text-danger hover:bg-danger-subtle"
                  >
                    <Trash2 aria-hidden />
                    Delete
                  </ActionButton>
                </ActionGroup>
              </li>
            ))
          )}
        </ul>
      </Card>

      <Card className="h-fit">
        <CardHeader title="Add a category" />
        <CardBody>
          <form action={formAction} className="space-y-3">
            {state.message ? (
              <Alert tone={state.status === "error" ? "error" : "success"}>
                {state.message}
              </Alert>
            ) : null}

            <Field
              label="Name"
              htmlFor="category-name"
              error={state.fieldErrors?.name}
              required
            >
              <Input
                id="category-name"
                name="name"
                placeholder="Consumables"
                required
                invalid={Boolean(state.fieldErrors?.name)}
              />
            </Field>

            <SubmitButton className="w-full" pendingLabel="Adding…">
              <Plus aria-hidden />
              Add category
            </SubmitButton>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

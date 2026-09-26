"use client";

import { useActionState } from "react";

import {
  AdjustmentLineEditor,
  type AdjustmentLineDraft,
  type ProductOption,
} from "@/components/documents/line-editor";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/form-state";
import { createAdjustmentAction, updateAdjustmentAction } from "@/server/actions/adjustments";

export function AdjustmentForm({
  locationId,
  locationName,
  products,
  initialLines,
  document,
  readOnly,
}: {
  locationId: string;
  locationName: string;
  products: ProductOption[];
  initialLines: AdjustmentLineDraft[];
  document?: { id: string; note: string | null };
  readOnly?: boolean;
}) {
  const isEdit = Boolean(document);
  const [state, formAction] = useActionState(
    isEdit ? updateAdjustmentAction : createAdjustmentAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="space-y-5">
      {isEdit ? <input type="hidden" name="id" value={document!.id} /> : null}
      <input type="hidden" name="locationId" value={locationId} />

      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}
      {state.status === "success" && state.message ? (
        <Alert tone="success">{state.message}</Alert>
      ) : null}

      <Card>
        <CardHeader
          title={`Counting ${locationName}`}
          description="Enter what is physically on the shelf. The difference is what gets corrected."
        />
        <CardBody className="space-y-4">
          <AdjustmentLineEditor
            products={products}
            initialLines={initialLines}
            disabled={readOnly}
          />

          <Field label="Note" htmlFor="note" hint="Why the count was taken, if it helps.">
            <Textarea
              id="note"
              name="note"
              rows={2}
              defaultValue={document?.note ?? ""}
              placeholder="Quarterly count, water damage on Rack B, and so on."
              disabled={readOnly}
            />
          </Field>
        </CardBody>
      </Card>

      {readOnly ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton pendingLabel="Saving…">
            {isEdit ? "Save changes" : "Create count"}
          </SubmitButton>
          <ButtonLink
            href={isEdit ? `/adjustments/${document!.id}` : "/adjustments"}
            variant="ghost"
          >
            Cancel
          </ButtonLink>
        </div>
      )}
    </form>
  );
}

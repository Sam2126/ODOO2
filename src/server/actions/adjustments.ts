"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { StockError } from "@/lib/errors";
import { field, formSuccess, toFormState, type FormState } from "@/lib/forms";
import { adjustmentLinesSchema, adjustmentSchema, parseJsonField } from "@/lib/validators";
import * as service from "@/server/services/adjustments";

/**
 * Server actions for inventory adjustments. As with pickings, these only
 * authenticate, parse and invalidate — the counting rules live in
 * `services/adjustments`.
 */

function revalidateAdjustment(id?: string) {
  revalidatePath("/adjustments");
  if (id) revalidatePath(`/adjustments/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/moves");
  revalidatePath("/products");
}

const readHeader = (formData: FormData) =>
  adjustmentSchema.parse({
    locationId: field(formData, "locationId"),
    note: field(formData, "note"),
  });

const readLines = (formData: FormData) =>
  parseJsonField(adjustmentLinesSchema, field(formData, "lines"));

export async function createAdjustmentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let destination = "";

  try {
    const user = await requireUser();
    const input = readHeader(formData);
    await service.assertCountableLocation(input.locationId);

    const adjustment = await service.createAdjustment(user.id, input, readLines(formData));

    revalidateAdjustment();
    destination = `/adjustments/${adjustment.id}`;
  } catch (error) {
    return toFormState(error);
  }

  redirect(destination);
}

export async function updateAdjustmentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requireUser();
    const id = field(formData, "id");
    if (!id) throw new StockError("Missing document reference.");

    const input = readHeader(formData);
    await service.assertCountableLocation(input.locationId);
    await service.updateAdjustment(id, input, readLines(formData));

    revalidateAdjustment(id);
    return formSuccess("Changes saved.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function validateAdjustmentAction(id: string): Promise<FormState> {
  try {
    const user = await requireUser();
    const { reference, corrected } = await service.validateAdjustment(user.id, id);

    revalidateAdjustment(id);
    return formSuccess(
      corrected === 0
        ? `${reference} applied. The count matched the system exactly — nothing to correct.`
        : `${reference} applied. ${corrected} product${corrected === 1 ? "" : "s"} corrected.`,
    );
  } catch (error) {
    return toFormState(error);
  }
}

export async function cancelAdjustmentAction(id: string): Promise<FormState> {
  try {
    await requireUser();
    await service.cancelAdjustment(id);
    revalidateAdjustment(id);
    return formSuccess("Count canceled. No stock was changed.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function resetAdjustmentToDraftAction(id: string): Promise<FormState> {
  try {
    await requireUser();
    await service.resetAdjustmentToDraft(id);
    revalidateAdjustment(id);
    return formSuccess("Back to draft.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteAdjustmentAction(id: string): Promise<FormState> {
  try {
    await requireUser();
    await service.deleteAdjustment(id);
    revalidateAdjustment();
  } catch (error) {
    return toFormState(error);
  }

  redirect("/adjustments");
}

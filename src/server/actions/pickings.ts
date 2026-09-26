"use server";

import { DocStatus, PickingType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { StockError } from "@/lib/errors";
import { field, formSuccess, toFormState, type FormState } from "@/lib/forms";
import { documentLinesSchema, parseJsonField, pickingSchema } from "@/lib/validators";
import * as service from "@/server/services/pickings";

/**
 * Server actions for receipts, delivery orders and internal transfers.
 *
 * These are deliberately thin: authenticate, parse the form, hand off to
 * `services/pickings`, invalidate the caches the change touched, and turn any
 * error into something the form can render. The inventory rules themselves
 * live in the service so they can be exercised without a request.
 */

export const PICKING_ROUTE: Record<PickingType, string> = {
  RECEIPT: "/receipts",
  DELIVERY: "/deliveries",
  INTERNAL: "/transfers",
};

function revalidatePicking(type: PickingType, id?: string) {
  const base = PICKING_ROUTE[type];
  revalidatePath(base);
  if (id) revalidatePath(`${base}/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/moves");
  revalidatePath("/products");
}

function readHeader(formData: FormData) {
  return pickingSchema.parse({
    type: field(formData, "type"),
    warehouseId: field(formData, "warehouseId"),
    sourceLocationId: field(formData, "sourceLocationId"),
    destLocationId: field(formData, "destLocationId"),
    partnerName: field(formData, "partnerName"),
    scheduledAt: field(formData, "scheduledAt"),
    note: field(formData, "note"),
  });
}

const readLines = (formData: FormData) =>
  parseJsonField(documentLinesSchema, field(formData, "lines"));

export async function createPickingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let destination = "";

  try {
    const user = await requireUser();
    const picking = await service.createPicking(
      user.id,
      readHeader(formData),
      readLines(formData),
    );

    revalidatePicking(picking.type);
    destination = `${PICKING_ROUTE[picking.type]}/${picking.id}`;
  } catch (error) {
    return toFormState(error);
  }

  redirect(destination);
}

export async function updatePickingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requireUser();
    const id = field(formData, "id");
    if (!id) throw new StockError("Missing document reference.");

    const type = await service.updatePicking(id, readHeader(formData), readLines(formData));

    revalidatePicking(type, id);
    return formSuccess("Changes saved.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function checkAvailabilityAction(id: string): Promise<FormState> {
  try {
    await requireUser();
    const { status, type } = await service.checkAvailability(id);

    revalidatePicking(type, id);
    return formSuccess(
      status === DocStatus.READY
        ? "Everything on this document is available. Marked as ready."
        : "Not all products are available at the source location. Marked as waiting.",
    );
  } catch (error) {
    return toFormState(error);
  }
}

export async function validatePickingAction(id: string): Promise<FormState> {
  try {
    const user = await requireUser();
    const { reference, type, moved } = await service.validatePicking(user.id, id);

    revalidatePicking(type, id);
    return formSuccess(
      `${reference} validated. ${moved} movement${moved === 1 ? "" : "s"} recorded in the ledger.`,
    );
  } catch (error) {
    return toFormState(error);
  }
}

export async function cancelPickingAction(id: string): Promise<FormState> {
  try {
    await requireUser();
    revalidatePicking(await service.cancelPicking(id), id);
    return formSuccess("Document canceled. No stock was moved.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function resetPickingToDraftAction(id: string): Promise<FormState> {
  try {
    await requireUser();
    revalidatePicking(await service.resetPickingToDraft(id), id);
    return formSuccess("Back to draft.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function deletePickingAction(id: string): Promise<FormState> {
  let destination = "";

  try {
    await requireUser();
    const type = await service.deletePicking(id);
    revalidatePicking(type);
    destination = PICKING_ROUTE[type];
  } catch (error) {
    return toFormState(error);
  }

  redirect(destination);
}

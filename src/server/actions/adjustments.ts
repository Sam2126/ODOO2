"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { StockError } from "@/lib/errors";
import {
field,
formSuccess,
toFormState,
type FormState,
} from "@/lib/forms";
import {
adjustmentLinesSchema,
adjustmentSchema,
parseJsonField,
} from "@/lib/validators";
import * as service from "@/server/services/adjustments";

/**

* Server actions for inventory adjustments.
*
* Responsibilities:
* * Authenticate the current user.
* * Validate and parse form input.
* * Delegate inventory/business rules to the service layer.
* * Revalidate affected pages.
* * Convert errors into a consistent FormState.
*
* Business rules should remain inside `services/adjustments`.
  */

const ADJUSTMENTS_PATH = "/adjustments";

function revalidateAdjustment(id?: string) {
const paths = [
ADJUSTMENTS_PATH,
"/dashboard",
"/moves",
"/products",
];

for (const path of paths) {
revalidatePath(path);
}

if (id) {
revalidatePath(`${ADJUSTMENTS_PATH}/${id}`);
}
}

function readAdjustmentHeader(formData: FormData) {
return adjustmentSchema.parse({
locationId: field(formData, "locationId"),
note: field(formData, "note"),
});
}

function readAdjustmentLines(formData: FormData) {
const rawLines = field(formData, "lines");

return parseJsonField(
adjustmentLinesSchema,
rawLines,
);
}

function getAdjustmentId(formData: FormData) {
const id = field(formData, "id");

if (!id) {
throw new StockError("Missing adjustment reference.");
}

return id;
}

export async function createAdjustmentAction(
_prev: FormState,
formData: FormData,
): Promise<FormState> {
try {
const user = await requireUser();

```
const input = readAdjustmentHeader(formData);
const lines = readAdjustmentLines(formData);

await service.assertCountableLocation(input.locationId);

const adjustment = await service.createAdjustment(
  user.id,
  input,
  lines,
);

revalidateAdjustment();

redirect(`${ADJUSTMENTS_PATH}/${adjustment.id}`);
```

} catch (error) {
return toFormState(error);
}
}

export async function updateAdjustmentAction(
_prev: FormState,
formData: FormData,
): Promise<FormState> {
try {
await requireUser();

```
const id = getAdjustmentId(formData);
const input = readAdjustmentHeader(formData);
const lines = readAdjustmentLines(formData);

await service.assertCountableLocation(input.locationId);

await service.updateAdjustment(
  id,
  input,
  lines,
);

revalidateAdjustment(id);

return formSuccess("Changes saved.");
```

} catch (error) {
return toFormState(error);
}
}

export async function validateAdjustmentAction(
id: string,
): Promise<FormState> {
try {
const user = await requireUser();

```
if (!id) {
  throw new StockError("Missing adjustment reference.");
}

const result = await service.validateAdjustment(
  user.id,
  id,
);

revalidateAdjustment(id);

const { reference, corrected } = result;

if (corrected === 0) {
  return formSuccess(
    `${reference} applied. The count matched the system exactly — nothing to correct.`,
  );
}

const productLabel = corrected === 1 ? "product" : "products";

return formSuccess(
  `${reference} applied. ${corrected} ${productLabel} corrected.`,
);
```

} catch (error) {
return toFormState(error);
}
}

export async function cancelAdjustmentAction(
id: string,
): Promise<FormState> {
try {
await requireUser();

```
if (!id) {
  throw new StockError("Missing adjustment reference.");
}

await service.cancelAdjustment(id);

revalidateAdjustment(id);

return formSuccess(
  "Count canceled. No stock was changed.",
);
```

} catch (error) {
return toFormState(error);
}
}

export async function resetAdjustmentToDraftAction(
id: string,
): Promise<FormState> {
try {
await requireUser();

```
if (!id) {
  throw new StockError("Missing adjustment reference.");
}

await service.resetAdjustmentToDraft(id);

revalidateAdjustment(id);

return formSuccess("Adjustment moved back to draft.");
```

} catch (error) {
return toFormState(error);
}
}

export async function deleteAdjustmentAction(
id: string,
): Promise<FormState> {
try {
await requireUser();

```
if (!id) {
  throw new StockError("Missing adjustment reference.");
}

await service.deleteAdjustment(id);

revalidateAdjustment();
```

} catch (error) {
return toFormState(error);
}

redirect(ADJUSTMENTS_PATH);
}

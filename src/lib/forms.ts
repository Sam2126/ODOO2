import "server-only";

import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { StockError } from "@/lib/errors";
import { formError, type FormState } from "@/lib/form-state";

export { formError, formSuccess, initialFormState } from "@/lib/form-state";
export type { FormState } from "@/lib/form-state";

/** First message per field — one error under each input, not a stack of them. */
export function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !(key in errors)) errors[key] = issue.message;
  }
  return errors;
}

/**
 * Turns a thrown error into something safe to render.
 *
 * Domain errors and known constraint violations carry messages written for the
 * user. Anything else is logged server-side and replaced with a generic line,
 * so an internal detail never reaches the browser.
 */
export function toFormState(error: unknown): FormState {
  if (error instanceof ZodError) {
    return formError("Please correct the highlighted fields.", fieldErrorsFrom(error));
  }

  if (error instanceof StockError) {
    return formError(error.message);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[] | undefined)?.join(", ");
      return formError(
        target
          ? `That ${target} is already in use. Pick another one.`
          : "That value is already in use.",
      );
    }
    if (error.code === "P2003") {
      return formError("This record is still referenced elsewhere and cannot be changed.");
    }
    if (error.code === "P2025") {
      return formError("That record no longer exists. Refresh and try again.");
    }
  }

  console.error("[action] unhandled error:", error);
  return formError("Something went wrong. Please try again.");
}

/** Reads a trimmed string from FormData, or undefined when blank. */
export function field(data: FormData, name: string) {
  const value = data.get(name);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * The contract between a form action and the component rendering it.
 *
 * Client components import from here rather than from `lib/forms`, which pulls
 * in Prisma and Zod and therefore belongs strictly on the server.
 */

export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  /** Keyed by input `name`, so each control can show its own message. */
  fieldErrors?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

export const formError = (
  message: string,
  fieldErrors?: Record<string, string>,
): FormState => ({ status: "error", message, fieldErrors });

export const formSuccess = (message?: string): FormState => ({
  status: "success",
  message,
});

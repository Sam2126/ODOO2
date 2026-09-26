import { LocationType, PickingType, Role, Uom } from "@prisma/client";
import { z } from "zod";

/** Quantities are stored as DECIMAL(14,3); reject anything that cannot fit. */
const quantity = (label: string, { allowZero = false } = {}) => {
  const base = z.coerce.number({ message: `${label} must be a number.` });
  return (allowZero
    ? base.min(0, `${label} cannot be negative.`)
    : base.positive(`${label} must be greater than zero.`)
  ).max(99_999_999_999, `${label} is too large.`);
};

const money = (label: string) =>
  z.coerce
    .number({ message: `${label} must be a number.` })
    .min(0, `${label} cannot be negative.`)
    .max(9_999_999_999, `${label} is too large.`)
    .optional();

const optionalText = z
  .string()
  .trim()
  .max(500, "Keep this under 500 characters.")
  .optional()
  .or(z.literal("").transform(() => undefined));

// ── Authentication ───────────────────────────────────────────────────────────

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80, "That name is too long."),
  email: z.email("Enter a valid email address.").toLowerCase(),
  password: z.string().min(8, "Use at least 8 characters."),
  role: z.enum(Role).default(Role.STAFF),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email address.").toLowerCase(),
  password: z.string().min(1, "Enter your password."),
});

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address.").toLowerCase(),
});

export const resetPasswordSchema = z
  .object({
    email: z.email("Enter a valid email address.").toLowerCase(),
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "The code is six digits."),
    password: z.string().min(8, "Use at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Both passwords must match.",
    path: ["confirmPassword"],
  });

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80, "That name is too long."),
  email: z.email("Enter a valid email address.").toLowerCase(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password: z.string().min(8, "Use at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Both passwords must match.",
    path: ["confirmPassword"],
  });

// ── Catalogue ────────────────────────────────────────────────────────────────

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Enter a category name.").max(60, "That name is too long."),
});

export const productSchema = z.object({
  name: z.string().trim().min(2, "Enter a product name.").max(120, "That name is too long."),
  sku: z
    .string()
    .trim()
    .min(2, "Enter a SKU.")
    .max(40, "That SKU is too long.")
    .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, "Use letters, digits, dot, dash, slash or underscore.")
    .transform((value) => value.toUpperCase()),
  uom: z.enum(Uom).default(Uom.UNIT),
  categoryId: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  costPrice: money("Cost price"),
  salePrice: money("Sale price"),
  isActive: z.coerce.boolean().default(true),
});

/** Only offered when creating: an opening balance booked into one location. */
export const openingStockSchema = z.object({
  locationId: z.string().trim().min(1),
  quantity: quantity("Initial stock"),
});

export const reorderRuleSchema = z
  .object({
    productId: z.string().min(1),
    warehouseId: z.string().min(1, "Choose a warehouse."),
    minQty: quantity("Minimum quantity", { allowZero: true }),
    maxQty: quantity("Maximum quantity", { allowZero: true }),
  })
  .refine((value) => value.maxQty === 0 || value.maxQty >= value.minQty, {
    message: "Maximum must be at least the minimum.",
    path: ["maxQty"],
  });

// ── Warehouses and locations ─────────────────────────────────────────────────

export const warehouseSchema = z.object({
  name: z.string().trim().min(2, "Enter a warehouse name.").max(80, "That name is too long."),
  code: z
    .string()
    .trim()
    .min(1, "Enter a short code.")
    .max(8, "Use 8 characters or fewer.")
    .regex(/^[A-Za-z0-9]+$/, "Letters and digits only — it becomes the WH/IN/00001 prefix.")
    .transform((value) => value.toUpperCase()),
  address: optionalText,
});

export const locationSchema = z.object({
  warehouseId: z.string().min(1, "Choose a warehouse."),
  name: z.string().trim().min(2, "Enter a location name.").max(80, "That name is too long."),
  code: z
    .string()
    .trim()
    .min(1, "Enter a short code.")
    .max(16, "Use 16 characters or fewer.")
    .regex(/^[A-Za-z0-9._-]+$/, "Use letters, digits, dot, dash or underscore.")
    .transform((value) => value.toUpperCase()),
  type: z.enum(LocationType).default(LocationType.INTERNAL),
});

// ── Documents ────────────────────────────────────────────────────────────────

export const documentLinesSchema = z
  .array(
    z.object({
      productId: z.string().min(1, "Choose a product."),
      demandQty: quantity("Demand quantity"),
      // What actually moves. Defaults to the demand when the line is created,
      // and can be trimmed before validating for a partial receipt or shipment.
      doneQty: quantity("Done quantity", { allowZero: true }).optional(),
    }),
  )
  .min(1, "Add at least one product line.")
  .refine((lines) => new Set(lines.map((line) => line.productId)).size === lines.length, {
    message: "Each product may appear only once. Combine the duplicate lines.",
  });

export const pickingSchema = z.object({
  type: z.enum(PickingType),
  warehouseId: z.string().min(1, "Choose a warehouse."),
  sourceLocationId: z.string().min(1, "Choose a source location."),
  destLocationId: z.string().min(1, "Choose a destination location."),
  partnerName: optionalText,
  scheduledAt: z.coerce.date({ message: "Enter a valid date." }),
  note: optionalText,
});

export const adjustmentLinesSchema = z
  .array(
    z.object({
      productId: z.string().min(1, "Choose a product."),
      countedQty: quantity("Counted quantity", { allowZero: true }),
    }),
  )
  .min(1, "Add at least one product line.");

export const adjustmentSchema = z.object({
  locationId: z.string().min(1, "Choose a location to count."),
  note: optionalText,
});

/** Line editors submit their rows as JSON in a single hidden input. */
export function parseJsonField<T extends z.ZodType>(schema: T, raw: string | undefined): z.infer<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? "[]");
  } catch {
    parsed = [];
  }
  return schema.parse(parsed);
}

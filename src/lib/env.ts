import "server-only";

import { z } from "zod";

/**
 * Environment is validated once, at first import, so a missing AUTH_SECRET
 * fails on boot with a readable message instead of surfacing later as an
 * unexplained 500 on the login form.
 */

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = z.preprocess(blankToUndefined, z.string().optional());

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.preprocess(blankToUndefined, z.coerce.number().int().positive().default(587)),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_FROM: z.preprocess(
    blankToUndefined,
    z.string().default("StockSense <no-reply@stocksense.local>"),
  ),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const env = {
  ...parsed.data,
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV !== "production",
};

/** SMTP is optional: without it, reset codes are logged to the server console. */
export const smtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);

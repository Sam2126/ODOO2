import "server-only";

import { headers } from "next/headers";

/**
 * Fixed-window rate limiting, held in memory.
 *
 * This is deliberately simple and has one honest limitation: the counters live
 * in the process, so a deployment running several instances limits per
 * instance rather than globally. For this application that is still worth
 * having — it turns an unlimited online guessing attack into a slow one — but
 * a production deployment behind more than one instance should back it with
 * Redis or Upstash and keep the same interface.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Without this the map grows for every distinct key ever seen.
const SWEEP_INTERVAL_MS = 5 * 60_000;
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;

  if (bucket.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}

/** Clears a counter — called after a success, so one typo does not cost the limit. */
export function clearRateLimit(key: string) {
  buckets.delete(key);
}

/**
 * Best-effort client identifier. `x-forwarded-for` is set by the proxy in front
 * of the app (Vercel, nginx); the first entry is the original client.
 */
export async function clientIp() {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headerList.get("x-real-ip") ?? "unknown";
}

export function retryMessage(seconds: number) {
  if (seconds < 60) return `Too many attempts. Try again in ${seconds} seconds.`;
  const minutes = Math.ceil(seconds / 60);
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/**
 * The limits, in one place so they can be read at a glance.
 *
 * Verifying a reset code is the tightest: six digits is a million
 * possibilities, which is only meaningful if guessing is capped.
 */
export const LIMITS = {
  login: { limit: 10, windowSeconds: 15 * 60 },
  loginPerEmail: { limit: 5, windowSeconds: 15 * 60 },
  signup: { limit: 5, windowSeconds: 60 * 60 },
  otpRequest: { limit: 3, windowSeconds: 15 * 60 },
  otpRequestPerIp: { limit: 10, windowSeconds: 60 * 60 },
  otpVerify: { limit: 5, windowSeconds: 15 * 60 },
  passwordChange: { limit: 5, windowSeconds: 15 * 60 },
} as const;

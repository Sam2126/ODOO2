import { jwtVerify, SignJWT } from "jose";

/**
 * Session token handling, kept free of bcrypt and Prisma so that middleware —
 * which runs on the Edge runtime — can import it. Anything needing the
 * database lives in `lib/auth.ts` instead.
 *
 * The token carries only the user id. Role and profile are read from the
 * database on each request, so revoking a manager takes effect immediately
 * rather than when their cookie happens to expire.
 */

export const SESSION_COOKIE = "stocksense_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

const ISSUER = "stocksense";
const AUDIENCE = "stocksense:web";

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET is missing or shorter than 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(userId: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

/** Returns the user id, or null for a missing, tampered or expired token. */
export async function readSessionToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

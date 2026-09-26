/**
 * Checks the security controls that are not visible in the UI.
 *
 * Rate limiting and session handling are the kind of thing that silently stops
 * working after a refactor, because nothing on screen changes. This exercises
 * them directly.
 *
 * Run with: npm run verify:security
 */
import { clearRateLimit, LIMITS, rateLimit, retryMessage } from "../src/lib/rate-limit";
import { readSessionToken, signSessionToken } from "../src/lib/session";
import { hashPassword, verifyPassword } from "../src/lib/password";

let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks += 1;
  const ok = Object.is(actual, expected);
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (expected ${expected}, got ${actual})`}`,
  );
}

async function main() {
  console.log("\nRate limiting");

  const loginKey = "login-email:attacker@example.com";
  for (let attempt = 1; attempt <= LIMITS.loginPerEmail.limit; attempt += 1) {
    const result = rateLimit(loginKey, LIMITS.loginPerEmail.limit, 900);
    if (attempt === LIMITS.loginPerEmail.limit) {
      check(`login attempt ${attempt} still allowed`, result.allowed, true);
    }
  }
  const blocked = rateLimit(loginKey, LIMITS.loginPerEmail.limit, 900);
  check("login attempt over the limit is blocked", blocked.allowed, false);
  check("blocked response carries a retry delay", blocked.retryAfterSeconds > 0, true);
  check(
    "retry message is readable",
    retryMessage(blocked.retryAfterSeconds).startsWith("Too many attempts"),
    true,
  );

  clearRateLimit(loginKey);
  check(
    "a correct password clears the lockout",
    rateLimit(loginKey, LIMITS.loginPerEmail.limit, 900).allowed,
    true,
  );

  check("other accounts keep their own budget", rateLimit("login-email:innocent@example.com", 5, 900).allowed, true);

  // Six digits is a million possibilities; the cap is what makes that safe.
  check("reset-code guessing is capped at 5", LIMITS.otpVerify.limit, 5);
  const otpKey = "otp-verify:victim@example.com";
  for (let i = 0; i < LIMITS.otpVerify.limit; i += 1) {
    rateLimit(otpKey, LIMITS.otpVerify.limit, 900);
  }
  check("6th reset-code guess is blocked", rateLimit(otpKey, LIMITS.otpVerify.limit, 900).allowed, false);

  const windowKey = "window:test";
  rateLimit(windowKey, 1, 1);
  check("second request inside the window is blocked", rateLimit(windowKey, 1, 1).allowed, false);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  check("allowed again once the window passes", rateLimit(windowKey, 1, 1).allowed, true);

  console.log("\nSession tokens");

  process.env.AUTH_SECRET ??= "x".repeat(64);
  const token = await signSessionToken("user_123");
  check("a valid token round-trips", await readSessionToken(token), "user_123");
  check("a missing token is rejected", await readSessionToken(undefined), null);
  check("a garbage token is rejected", await readSessionToken("not.a.token"), null);

  // Flip a character in the signature — the payload is unchanged, so only the
  // signature check can catch this.
  const parts = token.split(".");
  const lastChar = parts[2]!.slice(-1);
  const tampered = `${parts[0]}.${parts[1]}.${parts[2]!.slice(0, -1)}${lastChar === "A" ? "B" : "A"}`;
  check("a tampered signature is rejected", await readSessionToken(tampered), null);

  // Re-sign the same payload with a different key.
  const realSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "y".repeat(64);
  const foreign = await signSessionToken("user_123");
  process.env.AUTH_SECRET = realSecret;
  check("a token signed with another key is rejected", await readSessionToken(foreign), null);

  console.log("\nPassword hashing");

  const hash = await hashPassword("stocksense123");
  check("the hash is not the password", hash === "stocksense123", false);
  check("it is a bcrypt digest", hash.startsWith("$2"), true);
  check("the right password verifies", await verifyPassword("stocksense123", hash), true);
  check("a wrong password does not", await verifyPassword("stocksense124", hash), false);
  check("hashing is salted (two hashes differ)", hash === (await hashPassword("stocksense123")), false);

  console.log(
    `\n${failures === 0 ? "All checks passed" : `${failures} CHECK(S) FAILED`} — ${checks - failures}/${checks}\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

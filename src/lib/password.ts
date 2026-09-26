import bcrypt from "bcryptjs";

/**
 * Password hashing, deliberately free of any Next.js import so that scripts
 * run outside the framework — the database seed, in particular — can reuse the
 * exact hashing the app uses rather than reimplementing it.
 */

const BCRYPT_ROUNDS = 10;

export const hashPassword = (plain: string) => bcrypt.hash(plain, BCRYPT_ROUNDS);

export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

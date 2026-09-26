import "server-only";

import { randomInt } from "node:crypto";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";

export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;

const generateCode = () => String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");

/**
 * Issues a single-use reset code.
 *
 * Only the bcrypt digest is stored, so a leaked database row cannot be
 * replayed. Any codes previously issued to this user are consumed first —
 * requesting a new code must invalidate the old one.
 */
export async function issueOtp(userId: string) {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  await prisma.$transaction([
    prisma.passwordOtp.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.passwordOtp.create({ data: { userId, codeHash, expiresAt } }),
  ]);

  return { code, expiresAt };
}

/**
 * Verifies a code and burns it in the same step, so a valid code cannot be
 * used twice even if two requests arrive together.
 */
export async function consumeOtp(userId: string, code: string) {
  const candidates = await prisma.passwordOtp.findMany({
    where: { userId, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  for (const candidate of candidates) {
    if (await bcrypt.compare(code, candidate.codeHash)) {
      const burned = await prisma.passwordOtp.updateMany({
        where: { id: candidate.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      // updateMany reports 0 if another request consumed it a moment earlier.
      return burned.count === 1;
    }
  }

  return false;
}

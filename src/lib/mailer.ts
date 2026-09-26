import "server-only";

import nodemailer from "nodemailer";

import { env, smtpConfigured } from "@/lib/env";
import { OTP_TTL_MINUTES } from "@/lib/otp";

/**
 * Without SMTP credentials the code is printed to the server console instead
 * of being emailed. That keeps `npm run dev` working on a laptop with no mail
 * setup, and keeps a demo from depending on a message actually arriving.
 */
async function send(to: string, subject: string, text: string) {
  if (!smtpConfigured) {
    console.info(
      `\n──────── StockSense mail (SMTP not configured) ────────\n` +
        `To:      ${to}\n` +
        `Subject: ${subject}\n\n${text}\n` +
        `───────────────────────────────────────────────────────\n`,
    );
    return { delivered: false as const };
  }

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! },
  });

  await transport.sendMail({ from: env.SMTP_FROM, to, subject, text });
  return { delivered: true as const };
}

export function sendPasswordResetCode(to: string, name: string, code: string) {
  return send(
    to,
    "Your StockSense password reset code",
    [
      `Hi ${name},`,
      "",
      `Your StockSense password reset code is ${code}.`,
      `It expires in ${OTP_TTL_MINUTES} minutes and can be used once.`,
      "",
      "If you did not ask to reset your password, you can ignore this message.",
    ].join("\n"),
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  endSession,
  getCurrentUser,
  hashPassword,
  requireUser,
  startSession,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  field,
  formError,
  formSuccess,
  toFormState,
  type FormState,
} from "@/lib/forms";
import { sendPasswordResetCode } from "@/lib/mailer";
import {
  clearRateLimit,
  clientIp,
  LIMITS,
  rateLimit,
  retryMessage,
} from "@/lib/rate-limit";
import { consumeOtp, issueOtp, OTP_TTL_MINUTES } from "@/lib/otp";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  updateProfileSchema,
} from "@/lib/validators";

/** Only relative paths, so `?next=` cannot be used to bounce to another site. */
const safeRedirect = (value: string | undefined) =>
  value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const ip = await clientIp();
    const gate = rateLimit(`signup:${ip}`, LIMITS.signup.limit, LIMITS.signup.windowSeconds);
    if (!gate.allowed) return formError(retryMessage(gate.retryAfterSeconds));

    const input = signupSchema.parse({
      name: field(formData, "name"),
      email: field(formData, "email"),
      password: field(formData, "password"),
      role: field(formData, "role"),
    });

    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      return formError("That email is already registered.", {
        email: "An account with this email already exists.",
      });
    }

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        role: input.role,
        passwordHash: await hashPassword(input.password),
      },
      select: { id: true },
    });

    await startSession(user.id);
  } catch (error) {
    return toFormState(error);
  }

  redirect("/dashboard");
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let destination = "/dashboard";

  try {
    // Two budgets: one per address, so a botnet cannot spread an attack on a
    // single account across many IPs, and one per IP so a single host cannot
    // sweep many accounts.
    const ip = await clientIp();
    const byIp = rateLimit(`login-ip:${ip}`, LIMITS.login.limit, LIMITS.login.windowSeconds);
    if (!byIp.allowed) return formError(retryMessage(byIp.retryAfterSeconds));

    const input = loginSchema.parse({
      email: field(formData, "email"),
      password: field(formData, "password"),
    });

    const byEmail = rateLimit(
      `login-email:${input.email}`,
      LIMITS.loginPerEmail.limit,
      LIMITS.loginPerEmail.windowSeconds,
    );
    if (!byEmail.allowed) return formError(retryMessage(byEmail.retryAfterSeconds));

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, passwordHash: true },
    });

    // Same message either way: confirming which half was wrong would let
    // someone enumerate registered email addresses.
    const valid = user && (await verifyPassword(input.password, user.passwordHash));
    if (!user || !valid) {
      return formError("Those details do not match an account.");
    }

    // A correct password clears the counters, so a few typos followed by the
    // right password does not leave the account locked out.
    clearRateLimit(`login-ip:${ip}`);
    clearRateLimit(`login-email:${input.email}`);

    await startSession(user.id);
    destination = safeRedirect(field(formData, "next"));
  } catch (error) {
    return toFormState(error);
  }

  redirect(destination);
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}

export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const ip = await clientIp();
    const byIp = rateLimit(
      `otp-request-ip:${ip}`,
      LIMITS.otpRequestPerIp.limit,
      LIMITS.otpRequestPerIp.windowSeconds,
    );
    if (!byIp.allowed) return formError(retryMessage(byIp.retryAfterSeconds));

    const input = forgotPasswordSchema.parse({ email: field(formData, "email") });

    const byEmail = rateLimit(
      `otp-request:${input.email}`,
      LIMITS.otpRequest.limit,
      LIMITS.otpRequest.windowSeconds,
    );
    if (!byEmail.allowed) return formError(retryMessage(byEmail.retryAfterSeconds));

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, name: true, email: true },
    });

    // Always report success, so this form cannot be used to discover which
    // addresses have accounts.
    if (user) {
      const { code } = await issueOtp(user.id);
      await sendPasswordResetCode(user.email, user.name, code);
    }

    return formSuccess(
      env.isDevelopment
        ? `If that email has an account, a ${OTP_TTL_MINUTES}-minute code is on its way. Without SMTP configured, it is printed in your terminal.`
        : `If that email has an account, a reset code valid for ${OTP_TTL_MINUTES} minutes has been sent.`,
    );
  } catch (error) {
    return toFormState(error);
  }
}

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const input = resetPasswordSchema.parse({
      email: field(formData, "email"),
      code: field(formData, "code"),
      password: field(formData, "password"),
      confirmPassword: field(formData, "confirmPassword") ?? "",
    });

    // Six digits is a million possibilities, which only means anything if
    // guessing is capped.
    const gate = rateLimit(
      `otp-verify:${input.email}`,
      LIMITS.otpVerify.limit,
      LIMITS.otpVerify.windowSeconds,
    );
    if (!gate.allowed) return formError(retryMessage(gate.retryAfterSeconds));

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    const accepted = user && (await consumeOtp(user.id, input.code));
    if (!user || !accepted) {
      return formError("That code is wrong, already used, or has expired.", {
        code: "Check the code and try again.",
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.password) },
    });

    clearRateLimit(`otp-verify:${input.email}`);
  } catch (error) {
    return toFormState(error);
  }

  redirect("/login?reset=1");
}

export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requireUser();
    const input = updateProfileSchema.parse({
      name: field(formData, "name"),
      email: field(formData, "email"),
    });

    if (input.email !== user.email) {
      const taken = await prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (taken) {
        return formError("That email is already registered.", {
          email: "Another account already uses this email.",
        });
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { name: input.name, email: input.email },
    });

    revalidatePath("/profile");
    revalidatePath("/", "layout");
    return formSuccess("Profile updated.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireUser();

    const gate = rateLimit(
      `password-change:${session.id}`,
      LIMITS.passwordChange.limit,
      LIMITS.passwordChange.windowSeconds,
    );
    if (!gate.allowed) return formError(retryMessage(gate.retryAfterSeconds));

    const input = changePasswordSchema.parse({
      currentPassword: field(formData, "currentPassword"),
      password: field(formData, "password"),
      confirmPassword: field(formData, "confirmPassword") ?? "",
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.id },
      select: { passwordHash: true },
    });

    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      return formError("Your current password is not correct.", {
        currentPassword: "This does not match your current password.",
      });
    }

    await prisma.user.update({
      where: { id: session.id },
      data: { passwordHash: await hashPassword(input.password) },
    });

    return formSuccess("Password changed.");
  } catch (error) {
    return toFormState(error);
  }
}

/** Used by the shell so the layout does not need to import auth helpers. */
export async function currentUser() {
  return getCurrentUser();
}

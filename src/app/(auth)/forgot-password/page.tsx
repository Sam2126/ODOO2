"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/form-state";
import { requestPasswordResetAction } from "@/server/actions/auth";

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState(requestPasswordResetAction, initialFormState);
  const sent = state.status === "success";

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          We will send a six-digit code to your email. It is valid for ten minutes and can be used
          once.
        </p>
      </header>

      <form action={formAction} className="space-y-4" noValidate>
        {state.message ? (
          <Alert tone={sent ? "success" : "error"}>{state.message}</Alert>
        ) : null}

        <Field label="Email" htmlFor="email" error={state.fieldErrors?.email} required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
            invalid={Boolean(state.fieldErrors?.email)}
          />
        </Field>

        <SubmitButton className="w-full" size="lg" pendingLabel="Sending code…">
          {sent ? "Send another code" : "Send reset code"}
        </SubmitButton>
      </form>

      {sent ? (
        <ButtonLink href="/reset-password" variant="secondary" size="lg" className="w-full">
          I have my code
        </ButtonLink>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

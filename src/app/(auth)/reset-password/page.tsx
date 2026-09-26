"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/form-state";
import { resetPasswordAction } from "@/server/actions/auth";

export default function ResetPasswordPage() {
  const [state, formAction] = useActionState(resetPasswordAction, initialFormState);

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Enter your code</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Use the six-digit code from your email, then choose a new password.
        </p>
      </header>

      <form action={formAction} className="space-y-4" noValidate>
        {state.status === "error" && state.message ? (
          <Alert tone="error">{state.message}</Alert>
        ) : null}

        <Field label="Email" htmlFor="email" error={state.fieldErrors?.email} required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            invalid={Boolean(state.fieldErrors?.email)}
          />
        </Field>

        <Field label="Reset code" htmlFor="code" error={state.fieldErrors?.code} required>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            required
            className="tabular text-center text-lg tracking-[0.5em]"
            invalid={Boolean(state.fieldErrors?.code)}
          />
        </Field>

        <Field
          label="New password"
          htmlFor="password"
          error={state.fieldErrors?.password}
          hint="At least 8 characters."
          required
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            invalid={Boolean(state.fieldErrors?.password)}
          />
        </Field>

        <Field
          label="Confirm new password"
          htmlFor="confirmPassword"
          error={state.fieldErrors?.confirmPassword}
          required
        >
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            invalid={Boolean(state.fieldErrors?.confirmPassword)}
          />
        </Field>

        <SubmitButton className="w-full" size="lg" pendingLabel="Updating password…">
          Set new password
        </SubmitButton>
      </form>

      <p className="text-sm text-muted-foreground">
        Need a new code?{" "}
        <Link href="/forgot-password" className="font-medium text-accent hover:underline">
          Request one
        </Link>
      </p>
    </div>
  );
}

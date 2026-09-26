"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/form-state";
import { signupAction } from "@/server/actions/auth";

export default function SignupPage() {
  const [state, formAction] = useActionState(signupAction, initialFormState);

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Takes a moment. You land straight on the inventory dashboard.
        </p>
      </header>

      <form action={formAction} className="space-y-4" noValidate>
        {state.status === "error" && state.message ? (
          <Alert tone="error">{state.message}</Alert>
        ) : null}

        <Field label="Full name" htmlFor="name" error={state.fieldErrors?.name} required>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            placeholder="Priya Nair"
            required
            invalid={Boolean(state.fieldErrors?.name)}
          />
        </Field>

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

        <Field
          label="Role"
          htmlFor="role"
          error={state.fieldErrors?.role}
          hint="Managers can also edit warehouses and categories."
        >
          <Select id="role" name="role" defaultValue="STAFF">
            <option value="STAFF">Warehouse staff</option>
            <option value="MANAGER">Inventory manager</option>
          </Select>
        </Field>

        <Field
          label="Password"
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
            required
            minLength={8}
            invalid={Boolean(state.fieldErrors?.password)}
          />
        </Field>

        <SubmitButton className="w-full" size="lg" pendingLabel="Creating account…">
          Create account
        </SubmitButton>
      </form>

      <p className="text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

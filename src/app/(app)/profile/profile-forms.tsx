"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { CardBody } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/form-state";
import { changePasswordAction, updateProfileAction } from "@/server/actions/auth";

export function ProfileDetailsForm({ name, email }: { name: string; email: string }) {
  const [state, formAction] = useActionState(updateProfileAction, initialFormState);

  return (
    <CardBody>
      <form action={formAction} className="space-y-3">
        {state.message ? (
          <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>
        ) : null}

        <div className="grid gap-x-5 sm:grid-cols-2">
          <Field label="Full name" htmlFor="profile-name" error={state.fieldErrors?.name} required>
            <Input
              id="profile-name"
              name="name"
              defaultValue={name}
              required
              invalid={Boolean(state.fieldErrors?.name)}
            />
          </Field>

          <Field label="Email" htmlFor="profile-email" error={state.fieldErrors?.email} required>
            <Input
              id="profile-email"
              name="email"
              type="email"
              defaultValue={email}
              required
              invalid={Boolean(state.fieldErrors?.email)}
            />
          </Field>
        </div>

        <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
      </form>
    </CardBody>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, initialFormState);

  return (
    <CardBody>
      {/* Remounting on success clears the fields rather than leaving the old
          password sitting in the form. */}
      <form
        key={state.status === "success" ? "done" : "editing"}
        action={formAction}
        className="space-y-3"
      >
        {state.message ? (
          <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>
        ) : null}

        <Field
          label="Current password"
          htmlFor="currentPassword"
          error={state.fieldErrors?.currentPassword}
          required
        >
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            invalid={Boolean(state.fieldErrors?.currentPassword)}
          />
        </Field>

        <div className="grid gap-x-5 sm:grid-cols-2">
          <Field
            label="New password"
            htmlFor="newPassword"
            error={state.fieldErrors?.password}
            hint="At least 8 characters."
            required
          >
            <Input
              id="newPassword"
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
            htmlFor="confirmNewPassword"
            error={state.fieldErrors?.confirmPassword}
            required
          >
            <Input
              id="confirmNewPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              invalid={Boolean(state.fieldErrors?.confirmPassword)}
            />
          </Field>
        </div>

        <SubmitButton variant="secondary" pendingLabel="Updating…">
          Change password
        </SubmitButton>
      </form>
    </CardBody>
  );
}

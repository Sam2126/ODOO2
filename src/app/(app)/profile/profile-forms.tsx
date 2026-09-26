"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { CardBody } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/form-state";
import {
changePasswordAction,
updateProfileAction,
} from "@/server/actions/auth";

export function ProfileDetailsForm({
name,
email,
}: {
name: string;
email: string;
}) {
const [state, formAction] = useActionState(
updateProfileAction,
initialFormState,
);

return ( <CardBody> <form action={formAction} className="space-y-6"> <div> <h2 className="text-lg font-semibold">Profile details</h2> <p className="mt-1 text-sm text-muted-foreground">
Update your personal information and account details. </p> </div>

```
    {state.message ? (
      <Alert
        tone={state.status === "error" ? "error" : "success"}
        role="alert"
      >
        {state.message}
      </Alert>
    ) : null}

    <div className="grid gap-5 sm:grid-cols-2">
      <Field
        label="Full name"
        htmlFor="profile-name"
        error={state.fieldErrors?.name}
        required
      >
        <Input
          id="profile-name"
          name="name"
          defaultValue={name}
          placeholder="Enter your full name"
          autoComplete="name"
          required
          invalid={Boolean(state.fieldErrors?.name)}
        />
      </Field>

      <Field
        label="Email address"
        htmlFor="profile-email"
        error={state.fieldErrors?.email}
        required
      >
        <Input
          id="profile-email"
          name="email"
          type="email"
          defaultValue={email}
          placeholder="you@example.com"
          autoComplete="email"
          required
          invalid={Boolean(state.fieldErrors?.email)}
        />
      </Field>
    </div>

    <div className="flex justify-end border-t pt-5">
      <SubmitButton pendingLabel="Saving…">
        Save changes
      </SubmitButton>
    </div>
  </form>
</CardBody>
```

);
}

export function ChangePasswordForm() {
const [state, formAction] = useActionState(
changePasswordAction,
initialFormState,
);

const [showPasswords, setShowPasswords] = useState(false);

const inputType = showPasswords ? "text" : "password";

return ( <CardBody>
<form
key={state.status === "success" ? "password-updated" : "password-form"}
action={formAction}
className="space-y-6"
> <div> <h2 className="text-lg font-semibold">Change password</h2> <p className="mt-1 text-sm text-muted-foreground">
Choose a strong password you don't use anywhere else. </p> </div>

```
    {state.message ? (
      <Alert
        tone={state.status === "error" ? "error" : "success"}
        role="alert"
      >
        {state.message}
      </Alert>
    ) : null}

    <div className="space-y-5">
      <Field
        label="Current password"
        htmlFor="currentPassword"
        error={state.fieldErrors?.currentPassword}
        required
      >
        <Input
          id="currentPassword"
          name="currentPassword"
          type={inputType}
          autoComplete="current-password"
          placeholder="Enter your current password"
          required
          invalid={Boolean(state.fieldErrors?.currentPassword)}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="New password"
          htmlFor="newPassword"
          error={state.fieldErrors?.password}
          hint="Use at least 8 characters. A longer password is recommended."
          required
        >
          <Input
            id="newPassword"
            name="password"
            type={inputType}
            autoComplete="new-password"
            placeholder="Enter a new password"
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
            type={inputType}
            autoComplete="new-password"
            placeholder="Confirm your new password"
            minLength={8}
            required
            invalid={Boolean(state.fieldErrors?.confirmPassword)}
          />
        </Field>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={showPasswords}
          onChange={(event) => setShowPasswords(event.target.checked)}
          className="h-4 w-4 rounded border"
        />
        Show passwords
      </label>
    </div>

    <div className="flex justify-end border-t pt-5">
      <SubmitButton
        variant="secondary"
        pendingLabel="Updating…"
      >
        Change password
      </SubmitButton>
    </div>
  </form>
</CardBody>
```

);
}

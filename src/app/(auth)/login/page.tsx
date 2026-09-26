import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const notice = params.reset === "1" ? "Password updated. Sign in with your new password." : undefined;

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Manage stock across every warehouse from one place.
        </p>
      </header>

      <LoginForm next={next} notice={notice} />

      <div className="rounded-md border border-dashed border-border bg-surface-muted/50 px-4 py-3">
        <p className="text-xs font-medium text-foreground">Demo accounts</p>
        <dl className="mt-1.5 space-y-0.5 font-mono text-xs text-muted-foreground">
          <div className="flex justify-between gap-3">
            <dt>manager@stocksense.app</dt>
            <dd>stocksense123</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>staff@stocksense.app</dt>
            <dd>stocksense123</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

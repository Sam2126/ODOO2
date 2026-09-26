import Link from "next/link";

/** Root 404 — reached before the signed-in shell exists, so it stands alone. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="font-mono text-sm tracking-widest text-muted-foreground uppercase">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">This page does not exist</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Check the address, or head back to the inventory dashboard.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
      >
        Go to dashboard
      </Link>
    </main>
  );
}

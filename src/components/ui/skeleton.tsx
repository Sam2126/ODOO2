/**
 * Loading placeholders.
 *
 * A note on where these may be used: a `loading.tsx` opens a Suspense
 * boundary, which makes Next.js start streaming the response — and once the
 * first byte is sent the HTTP status is fixed at 200. A page that can call
 * `notFound()` would then answer a missing record with 200 instead of 404.
 *
 * So skeletons live only on segments with no `notFound()` beneath them:
 * the dashboard, the ledger, the profile and the settings pages. The detail
 * routes under /products/[id], /receipts/[id] and friends deliberately have
 * none.
 */

export function SkeletonHeader() {
  return (
    <div className="space-y-2">
      <div className="h-7 w-56 rounded-md bg-surface-muted" />
      <div className="h-4 w-80 rounded bg-surface-muted" />
    </div>
  );
}

export function SkeletonFilters() {
  return <div className="h-16 rounded-lg border border-border bg-surface" />;
}

export function SkeletonTiles({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="h-24 rounded-lg border border-border bg-surface" />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="h-10 border-b border-border bg-surface-muted/60" />
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
        >
          <div className="h-4 flex-1 rounded bg-surface-muted" />
          <div className="h-4 w-24 rounded bg-surface-muted" />
          <div className="h-4 w-16 rounded bg-surface-muted" />
          <div className="h-5 w-20 rounded-full bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "h-64" }: { className?: string }) {
  return <div className={`rounded-lg border border-border bg-surface ${className}`} />;
}

export function SkeletonPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      {children}
    </div>
  );
}

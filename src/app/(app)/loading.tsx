/**
 * Shown while a server component is fetching. Mirrors the usual page shape —
 * header, filter bar, table — so the layout does not jump when data arrives.
 */
export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-md bg-surface-muted" />
        <div className="h-4 w-80 rounded bg-surface-muted" />
      </div>

      <div className="h-16 rounded-lg border border-border bg-surface" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-24 rounded-lg border border-border bg-surface" />
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="h-10 border-b border-border bg-surface-muted/60" />
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-b border-border px-4 py-3">
            <div className="h-4 flex-1 rounded bg-surface-muted" />
            <div className="h-4 w-24 rounded bg-surface-muted" />
            <div className="h-4 w-16 rounded bg-surface-muted" />
            <div className="h-5 w-20 rounded-full bg-surface-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

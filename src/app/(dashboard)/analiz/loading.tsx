export default function AnalizLoading() {
  return (
    <div className="space-y-4">
      {/* Tab skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-28 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="mb-2 h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-7 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      {/* Chart skeleton */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <div className="mb-4 h-5 w-32 animate-pulse rounded bg-muted" />
          <div className="h-48 w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="rounded-lg border p-4">
          <div className="mb-4 h-5 w-32 animate-pulse rounded bg-muted" />
          <div className="h-48 w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

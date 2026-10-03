export default function AnalizLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-40 animate-pulse rounded bg-muted" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 w-24 shrink-0 animate-pulse rounded-full bg-muted" />
        ))}
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-28 shrink-0 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
      <div className="h-72 w-full animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

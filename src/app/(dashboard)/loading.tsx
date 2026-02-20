export default function DashboardLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-4 border-vw-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Yukleniyor...</p>
      </div>
    </div>
  );
}

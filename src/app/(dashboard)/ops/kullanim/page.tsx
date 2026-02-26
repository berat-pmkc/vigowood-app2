import { getUsageStats } from "../actions";
import { KullanimClient } from "./components/kullanim-client";

export default async function KullanimPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period = (params.period as "day" | "week" | "month") ?? "week";
  const stats = await getUsageStats(period);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-vw-dark">Kullanım</h1>
        <p className="text-sm text-muted-foreground">
          Asistan kullanım istatistikleri ve maliyet takibi
        </p>
      </div>
      <KullanimClient stats={stats} currentPeriod={period} />
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";
import { HAZIR_ELEMAN_TURLERI } from "@/lib/constants";
import type { DailyChartData } from "../components/trend-chart";

const TrendChart = dynamic(
  () => import("../components/trend-chart").then((mod) => ({ default: mod.TrendChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

interface GrafikClientProps {
  chartData: DailyChartData[];
  tur: string;
}

export function GrafikClient({ chartData, tur }: GrafikClientProps) {
  const router = useRouter();

  const handleTurChange = (newTur: string) => {
    const params = new URLSearchParams();
    if (newTur) params.set("tur", newTur);
    const qs = params.toString();
    router.push(`/stok/hazir-eleman/grafik${qs ? `?${qs}` : ""}`);
  };

  const subtitle = tur
    ? `Son 30 gün — ${tur} hareketleri`
    : "Son 30 gün stok giriş trendi";

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/stok/hazir-eleman">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hazır Eleman Hareketleri</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {/* Tür filtre butonları */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button
          variant={tur === "" ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => handleTurChange("")}
        >
          Tümü
        </Button>
        {HAZIR_ELEMAN_TURLERI.map((t) => (
          <Button
            key={t}
            variant={tur === t ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleTurChange(t)}
          >
            {t}
          </Button>
        ))}
      </div>

      <TrendChart data={chartData} title={tur ? `Son 30 Gün — ${tur} Girişleri` : undefined} />
    </div>
  );
}

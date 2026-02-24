"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";
import type { DailyChartData } from "../components/trend-chart";

const TrendChart = dynamic(
  () => import("../components/trend-chart").then((mod) => ({ default: mod.TrendChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export function GrafikClient({ chartData }: { chartData: DailyChartData[] }) {
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
          <p className="text-sm text-muted-foreground">
            Son 30 gün stok giriş trendi
          </p>
        </div>
      </div>

      <TrendChart data={chartData} />
    </div>
  );
}

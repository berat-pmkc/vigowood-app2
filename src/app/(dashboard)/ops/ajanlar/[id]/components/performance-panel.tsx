"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";
import { CheckCircle2, Clock, Zap, TrendingUp } from "lucide-react";
import { getAgentPerformance, type AgentPerformance } from "../../../actions";

const PerformanceTrendChart = dynamic(
  () => import("./performance-trend-chart").then((mod) => ({ default: mod.PerformanceTrendChart })),
  { ssr: false, loading: () => <ChartSkeleton height={200} /> }
);

interface PerformancePanelProps {
  agentCode: string;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function PerformancePanel({ agentCode }: PerformancePanelProps) {
  const [data, setData] = useState<AgentPerformance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAgentPerformance(agentCode).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [agentCode]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <ChartSkeleton height={200} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto text-vw-success mb-1" />
            <p className="text-2xl font-bold text-vw-dark">{data.totalCompletedTasks}</p>
            <p className="text-xs text-muted-foreground">Tamamlanan Görev</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto text-blue-500 mb-1" />
            <p className="text-2xl font-bold text-vw-dark">
              {data.avgTaskDurationHours < 1
                ? `${Math.round(data.avgTaskDurationHours * 60)}dk`
                : `${data.avgTaskDurationHours.toFixed(1)}sa`}
            </p>
            <p className="text-xs text-muted-foreground">Ort. Görev Süresi</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Zap className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <p className="text-2xl font-bold text-vw-dark">
              {formatTokens(data.totalTokensUsed)}
            </p>
            <p className="text-xs text-muted-foreground">Toplam Token</p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" />
            Son 7 Gün Görev Trendi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PerformanceTrendChart data={data.dailyTrend} />
        </CardContent>
      </Card>
    </div>
  );
}

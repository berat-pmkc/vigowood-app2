"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";
import { DollarSign, TrendingUp, TrendingDown, PieChart as PieChartIcon } from "lucide-react";
import { getAgentCosts, type AgentCosts } from "../../../actions";

const CostBarChart = dynamic(
  () => import("./cost-bar-chart").then((mod) => ({ default: mod.CostBarChart })),
  { ssr: false, loading: () => <ChartSkeleton height={200} /> }
);

const TokenPieChart = dynamic(
  () => import("./token-pie-chart").then((mod) => ({ default: mod.TokenPieChart })),
  { ssr: false, loading: () => <ChartSkeleton height={200} /> }
);

interface CostPanelProps {
  agentCode: string;
}

export function CostPanel({ agentCode }: CostPanelProps) {
  const [data, setData] = useState<AgentCosts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAgentCosts(agentCode).then((d) => {
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
        <div className="grid md:grid-cols-2 gap-4">
          <ChartSkeleton height={200} />
          <ChartSkeleton height={200} />
        </div>
      </div>
    );
  }

  const costChange = data.lastMonthCost > 0
    ? ((data.thisMonthCost - data.lastMonthCost) / data.lastMonthCost) * 100
    : 0;
  const costUp = costChange > 0;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-vw-primary mb-1" />
            <p className="text-2xl font-bold text-vw-dark">
              ${data.totalCost.toFixed(4)}
            </p>
            <p className="text-xs text-muted-foreground">Toplam Harcama</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-blue-500 mb-1" />
            <p className="text-2xl font-bold text-vw-dark">
              ${data.thisMonthCost.toFixed(4)}
            </p>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <p className="text-xs text-muted-foreground">Bu Ay</p>
              {costChange !== 0 && (
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1 py-0 ${
                    costUp ? "text-red-600 border-red-200" : "text-green-600 border-green-200"
                  }`}
                >
                  {costUp ? (
                    <TrendingUp className="h-2.5 w-2.5 mr-0.5 inline" />
                  ) : (
                    <TrendingDown className="h-2.5 w-2.5 mr-0.5 inline" />
                  )}
                  {Math.abs(costChange).toFixed(0)}%
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold text-vw-dark">
              ${data.lastMonthCost.toFixed(4)}
            </p>
            <p className="text-xs text-muted-foreground">Geçen Ay</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <PieChartIcon className="h-4 w-4" />
              Token Dağılımı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TokenPieChart
              inputTokens={data.totalInputTokens}
              outputTokens={data.totalOutputTokens}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" />
              Günlük Maliyet (Son 30 Gün)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CostBarChart data={data.dailyCosts} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

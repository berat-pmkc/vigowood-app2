"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wrench, Users, Clock, TrendingUp, Loader2 } from "lucide-react";
import { getMontajAnalytics } from "../actions";
import { cn } from "@/lib/utils";

type Period = "today" | "week" | "month" | "lastMonth";

interface AnalyticsData {
  totalQty: number;
  uniqueWorkers: number;
  totalMinutes: number;
  sessionCount: number;
  avgBirimDk: number;
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "Bugün",
  week: "Hafta",
  month: "Ay",
  lastMonth: "Geçen Ay",
};

export function SummaryCards() {
  const [period, setPeriod] = useState<Period>("today");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getMontajAnalytics(period).then((result) => {
      if (result.success) setData(result.data);
      setLoading(false);
    });
  }, [period]);

  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${mins} dk`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}s ${m}dk`;
  };

  return (
    <div className="space-y-3">
      {/* Period toggle */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <Button
            key={p}
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-3 text-xs",
              period === p && "bg-background shadow-sm font-medium"
            )}
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABELS[p]}
          </Button>
        ))}
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Yükleniyor...
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wrench className="w-4 h-4 text-vw-primary" />
              <span className="text-xs text-muted-foreground">Toplam Montaj</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{data.totalQty}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.sessionCount} seans
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Çalışan Kişi</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{data.uniqueWorkers}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Benzersiz Operatör</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Toplam Süre</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{formatMinutes(data.totalMinutes)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Seans Süresi</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Ort. Birim Süre</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {data.avgBirimDk > 0 ? `${data.avgBirimDk} dk` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">dk / (Adet x Kişi)</p>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

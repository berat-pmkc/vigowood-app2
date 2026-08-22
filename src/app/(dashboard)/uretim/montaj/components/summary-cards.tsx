"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wrench, Users, Clock, TrendingUp, Loader2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getMontajAnalytics } from "../actions";
import { cn } from "@/lib/utils";
import { sonHaftalar, sonAylar, donemAciklama } from "@/lib/donem";

interface AnalyticsData {
  totalQty: number;
  uniqueWorkers: number;
  totalMinutes: number;
  sessionCount: number;
  avgBirimDk: number;
}

export function SummaryCards() {
  // Dönem kodu etiketin kendisi: "bugun" | "2026_08.2" | "2026_08"
  const [donem, setDonem] = useState<string>("bugun");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const haftalar = useMemo(() => sonHaftalar(12), []);
  const aylar = useMemo(() => sonAylar(12), []);

  useEffect(() => {
    setLoading(true);
    getMontajAnalytics(donem).then((result) => {
      if (result.success) setData(result.data);
      setLoading(false);
    });
  }, [donem]);

  const haftaSecili = donem.includes(".");
  const aySecili = !haftaSecili && donem !== "bugun";

  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${mins} dk`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}s ${m}dk`;
  };

  return (
    <div className="space-y-3">
      {/* Dönem seçimi: Bugün + hafta listesi + ay listesi */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 border px-3 text-xs",
            donem === "bugun" ? "border-vw-primary bg-vw-primary/10 font-medium" : "border-transparent bg-muted/50",
          )}
          onClick={() => setDonem("bugun")}
        >
          Bugün
        </Button>

        <Select value={haftaSecili ? donem : ""} onValueChange={setDonem}>
          <SelectTrigger
            className={cn("h-8 w-[150px] text-xs", haftaSecili && "border-vw-primary bg-vw-primary/10")}
          >
            <SelectValue placeholder="Hafta seç" />
          </SelectTrigger>
          <SelectContent>
            {haftalar.map((h) => (
              <SelectItem key={h} value={h} className="text-xs">
                {h}
                <span className="ml-2 text-muted-foreground">{donemAciklama(h)}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={aySecili ? donem : ""} onValueChange={setDonem}>
          <SelectTrigger
            className={cn("h-8 w-[140px] text-xs", aySecili && "border-vw-primary bg-vw-primary/10")}
          >
            <SelectValue placeholder="Ay seç" />
          </SelectTrigger>
          <SelectContent>
            {aylar.map((a) => (
              <SelectItem key={a} value={a} className="text-xs">
                {a}
                <span className="ml-2 text-muted-foreground">{donemAciklama(a)}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground">{donemAciklama(donem)}</span>
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

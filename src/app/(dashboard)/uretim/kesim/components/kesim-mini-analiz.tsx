"use client";

import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Cpu, Package } from "lucide-react";

export interface MiniAnalizData {
  gunlukTrend: { gun: string; plaka: number }[];
  makineDagilim: { makine: string; plaka: number }[];
  topProjeler: { ad: string; plaka: number }[];
  toplam30: number;
}

const MAKINE_RENK: Record<string, string> = {
  "MAK-1": "#70c1aa", // success
  "MAK-2": "#f28a19", // warning
  "MAK-3": "#3368b1", // info
};

interface TrendTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function TrendTooltip({ active, payload, label }: TrendTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-white px-2.5 py-1.5 text-xs shadow-sm">
      <p className="font-medium text-vw-dark">{label}</p>
      <p className="text-muted-foreground">{payload[0].value} plaka</p>
    </div>
  );
}

export function KesimMiniAnaliz({ data }: { data: MiniAnalizData }) {
  const { gunlukTrend, makineDagilim, topProjeler, toplam30 } = data;
  const makineMax = Math.max(1, ...makineDagilim.map((m) => m.plaka));
  const projeMax = Math.max(1, ...topProjeler.map((p) => p.plaka));
  const trendMax = Math.max(...gunlukTrend.map((g) => g.plaka));

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Son 14 gün trend */}
      <Card>
        <CardHeader className="pb-1.5">
          <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
            <TrendingUp className="w-4 h-4 text-vw-primary" />
            Son 14 Gün
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              30 günde {toplam30} plaka
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          {trendMax === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Son 14 günde kesim yok
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={gunlukTrend} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <XAxis
                  dataKey="gun"
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  interval={1}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<TrendTooltip />} cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="plaka" radius={[3, 3, 0, 0]} fill="#cdbd9d" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Makine dağılımı */}
      <Card>
        <CardHeader className="pb-1.5">
          <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
            <Cpu className="w-4 h-4 text-vw-primary" />
            Makine Dağılımı
            <span className="ml-auto text-xs font-normal text-muted-foreground">30 gün</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3 space-y-2.5">
          {makineDagilim.map((m) => (
            <div key={m.makine}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-vw-dark">{m.makine}</span>
                <span className="text-muted-foreground">{m.plaka} plaka</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(m.plaka / makineMax) * 100}%`,
                    backgroundColor: MAKINE_RENK[m.makine] ?? "#cdbd9d",
                  }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* En çok kesilen projeler */}
      <Card>
        <CardHeader className="pb-1.5">
          <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
            <Package className="w-4 h-4 text-vw-primary" />
            En Çok Kesilen
            <span className="ml-auto text-xs font-normal text-muted-foreground">30 gün</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3 space-y-2">
          {topProjeler.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Veri yok</p>
          ) : (
            topProjeler.map((p) => (
              <div key={p.ad} className="flex items-center gap-2">
                <span className="w-16 shrink-0 truncate text-xs font-medium text-vw-dark" title={p.ad}>
                  {p.ad}
                </span>
                <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-vw-primary"
                    style={{ width: `${(p.plaka / projeMax) * 100}%` }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right text-xs text-muted-foreground">
                  {p.plaka}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

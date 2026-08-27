"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import type { KarlilikRow } from "./karlilik-tab";

interface Row { sku: string; kar: number; marj: number }

function Tip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Row }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-background p-3 shadow-md">
      <p className="mb-1 text-sm font-medium">{r.sku}</p>
      <p className="text-sm text-muted-foreground">Kâr: <span className="font-semibold text-foreground">₺{formatNumber(r.kar)}</span></p>
      <p className="text-sm text-muted-foreground">Marj: <span className="font-semibold text-foreground">%{r.marj.toFixed(1)}</span></p>
    </div>
  );
}

export function KarlilikChart({ rows }: { rows: KarlilikRow[] }) {
  const tam = rows.filter((r) => !r.eksik);
  const sirali = [...tam].sort((a, b) => b.kar - a.kar);
  const top = sirali.slice(0, 8);
  const alt = sirali.slice(-4).filter((r) => r.kar < 0 && !top.includes(r));
  const data: Row[] = [...top, ...alt].map((r) => ({
    sku: r.sku, kar: Math.round(r.kar), marj: r.marj,
  }));
  if (data.length === 0) return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          En Kârlı / Zararlı Ürünler
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Seçili dönemde toplam kâr (yalnızca birim maliyeti tam olan ürünler)
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(240, data.length * 34)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e1d6" />
            <XAxis type="number" tickFormatter={(v) => `₺${formatNumber(v)}`} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="sku" width={70} tick={{ fontSize: 11 }} />
            <Tooltip content={<Tip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Bar dataKey="kar" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.kar >= 0 ? "#70c1aa" : "#ee7683"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

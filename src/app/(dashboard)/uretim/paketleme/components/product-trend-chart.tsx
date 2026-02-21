"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, TrendingUp } from "lucide-react";
import { getProductTrend } from "../actions";

interface ProductOption {
  sku: string;
  urun_adi: string;
}

interface TrendPoint {
  date: string;
  birimDk: number;
  qty: number;
}

interface ProductTrendChartProps {
  products: ProductOption[];
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}`;
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-background p-3 shadow-md">
      <p className="mb-1.5 text-sm font-medium text-foreground">
        {formatDateFull(label as string)}
      </p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}:{" "}
          <span className="font-semibold">
            {entry.dataKey === "birimDk" ? `${entry.value} dk` : `${entry.value} adet`}
          </span>
        </p>
      ))}
    </div>
  );
}

export function ProductTrendChart({ products }: ProductTrendChartProps) {
  const [selectedSku, setSelectedSku] = useState<string>("");
  const [data, setData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedSku) {
      setData([]);
      return;
    }
    setLoading(true);
    getProductTrend(selectedSku, 60).then((result) => {
      if (result.success) {
        // Aggregate by date
        const byDate = new Map<string, { totalDk: number; totalQty: number; count: number }>();
        result.data.forEach((s) => {
          if (!s.end_time || !s.birim_paketleme_dk) return;
          const date = s.end_time.split("T")[0];
          const existing = byDate.get(date);
          if (existing) {
            existing.totalDk += s.birim_paketleme_dk;
            existing.totalQty += s.qty || 0;
            existing.count++;
          } else {
            byDate.set(date, {
              totalDk: s.birim_paketleme_dk,
              totalQty: s.qty || 0,
              count: 1,
            });
          }
        });

        const points: TrendPoint[] = Array.from(byDate.entries())
          .map(([date, val]) => ({
            date,
            birimDk: Math.round((val.totalDk / val.count) * 100) / 100,
            qty: val.totalQty,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        setData(points);
      }
      setLoading(false);
    });
  }, [selectedSku]);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Ürün Bazlı Birim Paketleme Süresi
          </CardTitle>
          <Select value={selectedSku} onValueChange={setSelectedSku}>
            <SelectTrigger className="w-full sm:w-[250px] h-8 text-xs">
              <SelectValue placeholder="Ürün seçin..." />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.sku} value={p.sku}>
                  <span className="truncate">{p.urun_adi}</span>
                  <span className="text-muted-foreground ml-1">({p.sku})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {!selectedSku ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            Trend görmek için ürün seçin
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Yükleniyor...
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            Bu ürün için veri bulunamadı
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart
              data={data}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id="pktBirimDk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3368b1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3368b1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#a99c7d"
                strokeOpacity={0.2}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateLabel}
                tick={{ fontSize: 11, fill: "#5e5747" }}
                tickLine={false}
                axisLine={{ stroke: "#a99c7d", strokeOpacity: 0.3 }}
                interval="preserveStartEnd"
                angle={-45}
                textAnchor="end"
                height={45}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#5e5747" }}
                tickLine={false}
                axisLine={false}
                width={45}
                label={{
                  value: "dk",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 11, fill: "#5e5747" },
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="birimDk"
                name="Birim Süre"
                stroke="#3368b1"
                strokeWidth={2}
                fill="url(#pktBirimDk)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

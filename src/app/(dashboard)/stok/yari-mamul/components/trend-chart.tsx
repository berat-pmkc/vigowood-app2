"use client";

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

export interface DailyChartData {
  date: string; // YYYY-MM-DD
  giris: number; // IN
  cikis: number; // OUT (positive number for display)
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
  payload?: Array<{ name: string; value: number; color: string }>;
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
          {entry.name}: <span className="font-semibold">{entry.value}</span> adet
        </p>
      ))}
    </div>
  );
}

export function TrendChart({ data }: { data: DailyChartData[] }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Son 30 Gün — Yarı Mamül Hareketleri
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart
            data={data}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id="ymColorGiris" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#70c1aa" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#70c1aa" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ymColorCikis" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ee7683" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ee7683" stopOpacity={0} />
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
              allowDecimals={false}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="giris"
              name="Giriş"
              stroke="#70c1aa"
              strokeWidth={2}
              fill="url(#ymColorGiris)"
            />
            <Area
              type="monotone"
              dataKey="cikis"
              name="Çıkış"
              stroke="#ee7683"
              strokeWidth={2}
              fill="url(#ymColorCikis)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface DailySalesData {
  date: string;
  tutar: number;
  adet: number;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}`;
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
          {entry.name}:{" "}
          <span className="font-semibold">
            {entry.name === "Tutar"
              ? `₺${entry.value.toLocaleString("tr-TR")}`
              : `${entry.value.toLocaleString("tr-TR")} adet`}
          </span>
        </p>
      ))}
    </div>
  );
}

export function SatisChart({ data, period }: { data: DailySalesData[]; period?: string }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Günlük Satış Trendi{period && period !== "all" ? "" : " (tüm zamanlar)"}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {data.length} gün
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={data}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
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
              width={60}
              tickFormatter={(v) => `₺${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="tutar"
              name="Tutar"
              fill="#70c1aa"
              radius={[3, 3, 0, 0]}
              maxBarSize={30}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

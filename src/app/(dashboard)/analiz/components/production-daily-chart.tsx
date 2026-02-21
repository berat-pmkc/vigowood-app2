"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface DailyProductionData {
  date: string;
  kesim: number;
  temizlik: number;
  montaj: number;
  paketleme: number;
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
          {entry.name}:{" "}
          <span className="font-semibold">
            {entry.value.toLocaleString("tr-TR")}
          </span>
        </p>
      ))}
    </div>
  );
}

export function ProductionDailyChart({
  data,
}: {
  data: DailyProductionData[];
}) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          İstasyon Bazlı Günlük Üretim (Son 30 Gün)
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <ResponsiveContainer width="100%" height={300}>
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
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            />
            <Bar
              dataKey="kesim"
              name="Kesim"
              stackId="a"
              fill="#cdbd9d"
              maxBarSize={24}
            />
            <Bar
              dataKey="temizlik"
              name="Temizlik"
              stackId="a"
              fill="#3368b1"
              maxBarSize={24}
            />
            <Bar
              dataKey="montaj"
              name="Montaj"
              stackId="a"
              fill="#f28a19"
              maxBarSize={24}
            />
            <Bar
              dataKey="paketleme"
              name="Paketleme"
              stackId="a"
              fill="#70c1aa"
              radius={[3, 3, 0, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

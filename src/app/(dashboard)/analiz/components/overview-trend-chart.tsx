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

export interface MonthlyTrendData {
  month: string; // "Oca", "Şub", etc.
  ciro: number;
  kar: number;
}

const MONTH_LABELS = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
];

export { MONTH_LABELS };

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-background p-3 shadow-md">
      <p className="mb-1.5 text-sm font-medium text-foreground">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}:{" "}
          <span className="font-semibold">
            ₺{entry.value.toLocaleString("tr-TR")}
          </span>
        </p>
      ))}
    </div>
  );
}

export function OverviewTrendChart({ data }: { data: MonthlyTrendData[] }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Aylık Ciro Trendi (Son 12 Ay)
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart
            data={data}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id="colorCiro" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#cdbd9d" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#cdbd9d" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#a99c7d"
              strokeOpacity={0.2}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "#5e5747" }}
              tickLine={false}
              axisLine={{ stroke: "#a99c7d", strokeOpacity: 0.3 }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#5e5747" }}
              tickLine={false}
              axisLine={false}
              width={60}
              tickFormatter={(v) =>
                v >= 1000 ? `₺${(v / 1000).toFixed(0)}k` : `₺${v}`
              }
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="ciro"
              name="Ciro"
              stroke="#cdbd9d"
              strokeWidth={2}
              fill="url(#colorCiro)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

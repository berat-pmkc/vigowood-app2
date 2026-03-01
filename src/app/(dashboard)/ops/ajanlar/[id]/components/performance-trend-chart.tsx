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

interface PerformanceTrendChartProps {
  data: { date: string; count: number }[];
}

export function PerformanceTrendChart({ data }: PerformanceTrendChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#70c1aa" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#70c1aa" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => [`${value} görev`, "Tamamlanan"]}
          labelStyle={{ fontSize: 12 }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#70c1aa"
          strokeWidth={2}
          fill="url(#colorCount)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

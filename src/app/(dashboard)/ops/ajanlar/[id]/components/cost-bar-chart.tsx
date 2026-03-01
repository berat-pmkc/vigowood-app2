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

interface CostBarChartProps {
  data: { date: string; cost: number }[];
}

export function CostBarChart({ data }: CostBarChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }),
    costFormatted: `$${d.cost.toFixed(4)}`,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10 }}
          interval={Math.ceil(chartData.length / 8)}
        />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          formatter={(value) => [`$${Number(value).toFixed(4)}`, "Maliyet"]}
          labelStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="cost" fill="#cdbd9d" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

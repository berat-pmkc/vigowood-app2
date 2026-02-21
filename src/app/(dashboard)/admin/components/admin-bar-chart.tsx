"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface AdminBarChartProps {
  data: { name: string; value: number }[];
  color?: string;
  colors?: string[];
  height?: number;
}

export function AdminBarChart({
  data,
  color = "#cdbd9d",
  colors,
  height = 300,
}: AdminBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(value: number | undefined) => [
            (value ?? 0).toLocaleString("tr-TR"),
            "Adet",
          ]}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            fontSize: 13,
          }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
          {data.map((_, index) => (
            <Cell
              key={index}
              fill={colors ? colors[index % colors.length] : color}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

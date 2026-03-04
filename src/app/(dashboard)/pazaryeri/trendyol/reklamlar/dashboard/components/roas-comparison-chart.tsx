"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface Props {
  data: { name: string; current: number; previous: number }[];
  hasPrev: boolean;
}

export default function RoasComparisonChart({ data, hasPrev }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          tick={{ fontSize: 11 }}
        />
        <Tooltip
          formatter={(value) => [`${Number(value).toFixed(2)}x`, ""]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend />
        <ReferenceLine x={10} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "10x", position: "top", fontSize: 10 }} />
        <Bar dataKey="current" name="Bu Hafta" fill="#cdbd9d" radius={[0, 4, 4, 0]} />
        {hasPrev && (
          <Bar dataKey="previous" name="Önceki" fill="#a99c7d" opacity={0.5} radius={[0, 4, 4, 0]} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

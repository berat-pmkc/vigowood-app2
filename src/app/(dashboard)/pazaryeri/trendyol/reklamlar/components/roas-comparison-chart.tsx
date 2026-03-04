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
  data: { name: string; roas: number }[];
}

export default function RoasComparisonChart({ data }: Props) {
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
          formatter={(value) => [`${Number(value).toFixed(2)}x`, "ROAS"]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend />
        <ReferenceLine x={10} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "10x", position: "top", fontSize: 10 }} />
        <Bar dataKey="roas" name="ROAS" fill="#cdbd9d" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

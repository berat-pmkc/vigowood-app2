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
} from "recharts";

interface Props {
  data: { name: string; harcama: number; ciro: number }[];
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
  return val.toFixed(0);
}

export default function SpendRevenueChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ left: 0, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10 }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
        <Tooltip
          formatter={(value, name) => [
            `${Number(value).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺`,
            String(name) === "harcama" ? "Harcama" : "Ciro",
          ]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend />
        <Bar dataKey="harcama" name="Harcama" fill="#ee7683" radius={[4, 4, 0, 0]} />
        <Bar dataKey="ciro" name="Ciro" fill="#70c1aa" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

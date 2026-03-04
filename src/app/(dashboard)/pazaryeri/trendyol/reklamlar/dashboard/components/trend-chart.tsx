"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TrendPoint {
  period: string;
  spent: number;
  revenue: number;
  sales: number;
  clicks: number;
  impressions: number;
}

interface Props {
  data: TrendPoint[];
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
  return val.toFixed(0);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });
}

export default function TrendChart({ data }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    label: formatDate(d.period),
    roas: d.spent > 0 ? Math.round((d.revenue / d.spent) * 100) / 100 : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData} margin={{ left: 0, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value, name) => {
            const v = Number(value);
            const n = String(name);
            if (n === "ROAS") return [`${v.toFixed(2)}x`, n];
            return [`${v.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺`, n];
          }}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend />
        <Bar yAxisId="left" dataKey="spent" name="Harcama" fill="#ee7683" opacity={0.7} radius={[4, 4, 0, 0]} />
        <Bar yAxisId="left" dataKey="revenue" name="Ciro" fill="#70c1aa" opacity={0.7} radius={[4, 4, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="roas" name="ROAS" stroke="#cdbd9d" strokeWidth={2} dot={{ r: 4 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

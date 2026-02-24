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
import { COLORS } from "@/lib/constants";

interface Props {
  data: { date: string; orders: number; ciro: number }[];
}

function formatTRY(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K ₺`;
  return `${value} ₺`;
}

export default function TrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        Veri bulunamadı
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
        <XAxis dataKey="date" fontSize={12} tickLine={false} />
        <YAxis
          yAxisId="left"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          label={{ value: "Sipariş", angle: -90, position: "insideLeft", fontSize: 11 }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatTRY}
          label={{ value: "Ciro", angle: 90, position: "insideRight", fontSize: 11 }}
        />
        <Tooltip
          formatter={(value, name) =>
            name === "ciro" ? [`${formatTRY(value as number)}`, "Ciro"] : [value, "Sipariş"]
          }
          contentStyle={{
            borderRadius: "8px",
            border: `1px solid ${COLORS.side}`,
            fontSize: "13px",
          }}
        />
        <Legend />
        <Bar
          yAxisId="left"
          dataKey="orders"
          name="Sipariş"
          fill={COLORS.info}
          radius={[4, 4, 0, 0]}
          barSize={32}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="ciro"
          name="Ciro"
          stroke={COLORS.success}
          strokeWidth={2}
          dot={{ fill: COLORS.success, r: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

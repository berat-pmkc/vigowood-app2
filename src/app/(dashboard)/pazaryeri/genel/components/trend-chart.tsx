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
  data: { date: string; orders: number; ciro: number; trendyolOrders?: number; trendyolCiro?: number; ikasOrders?: number; ikasCiro?: number }[];
}

function formatTRY(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K ₺`;
  return `${value} ₺`;
}

const TRENDYOL_COLOR = "#f97316"; // orange-500
const IKAS_COLOR = "#10b981"; // emerald-500

export default function TrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        Veri bulunamadı
      </div>
    );
  }

  const hasChannelData = data.some((d) => d.trendyolOrders !== undefined);

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
          formatter={(value, name) => {
            const n = name as string;
            if (n.includes("Ciro")) return [formatTRY(value as number), n];
            return [value, n];
          }}
          contentStyle={{
            borderRadius: "8px",
            border: `1px solid ${COLORS.side}`,
            fontSize: "13px",
          }}
        />
        <Legend />
        {hasChannelData ? (
          <>
            <Bar yAxisId="left" dataKey="trendyolOrders" name="Trendyol Sipariş" stackId="orders" fill={TRENDYOL_COLOR} barSize={32} />
            <Bar yAxisId="left" dataKey="ikasOrders" name="VW Sipariş" stackId="orders" fill={IKAS_COLOR} radius={[4, 4, 0, 0]} barSize={32} />
          </>
        ) : (
          <Bar yAxisId="left" dataKey="orders" name="Sipariş" fill={COLORS.info} radius={[4, 4, 0, 0]} barSize={32} />
        )}
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="ciro"
          name="Toplam Ciro"
          stroke={COLORS.success}
          strokeWidth={2}
          dot={{ fill: COLORS.success, r: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

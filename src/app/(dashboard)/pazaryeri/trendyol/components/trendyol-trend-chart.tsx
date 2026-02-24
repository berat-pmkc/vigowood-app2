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
import { formatTRY } from "@/lib/trendyol/helpers";

interface TrendDataPoint {
  date: string;
  orders: number;
  ciro: number;
}

interface Props {
  data: TrendDataPoint[];
}

export default function TrendyolTrendChart({ data }: Props) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: COLORS.deep }}
          tickLine={false}
          axisLine={{ stroke: COLORS.side, strokeOpacity: 0.3 }}
          angle={-45}
          textAnchor="end"
          height={50}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
            const labels: Record<string, string> = {
              orders: "Sipariş",
              ciro: "Ciro",
            };
            const n = String(name);
            return [
              n === "ciro" ? formatTRY(Number(value)) : value,
              labels[n] || n,
            ];
          }}
          contentStyle={{
            borderRadius: "8px",
            border: `1px solid ${COLORS.side}`,
            fontSize: "13px",
          }}
        />
        <Legend
          formatter={(value: string) => {
            const labels: Record<string, string> = {
              orders: "Sipariş Adedi",
              ciro: "Ciro (₺)",
            };
            return labels[value] || value;
          }}
        />
        <Bar
          yAxisId="left"
          dataKey="orders"
          fill="#f97316"
          radius={[3, 3, 0, 0]}
          barSize={14}
          opacity={0.85}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="ciro"
          stroke={COLORS.info}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

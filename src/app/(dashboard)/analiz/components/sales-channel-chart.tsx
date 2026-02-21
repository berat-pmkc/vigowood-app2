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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ChannelSalesData {
  kanal: string;
  tutar: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-background p-3 shadow-md">
      <p className="mb-1.5 text-sm font-medium text-foreground">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}:{" "}
          <span className="font-semibold">
            ₺{entry.value.toLocaleString("tr-TR")}
          </span>
        </p>
      ))}
    </div>
  );
}

export function SalesChannelChart({ data }: { data: ChannelSalesData[] }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Kanal Bazlı Satış Dağılımı
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={data}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#a99c7d"
              strokeOpacity={0.2}
            />
            <XAxis
              dataKey="kanal"
              tick={{ fontSize: 11, fill: "#5e5747" }}
              tickLine={false}
              axisLine={{ stroke: "#a99c7d", strokeOpacity: 0.3 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#5e5747" }}
              tickLine={false}
              axisLine={false}
              width={60}
              tickFormatter={(v) =>
                v >= 1000 ? `₺${(v / 1000).toFixed(0)}k` : `₺${v}`
              }
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="tutar"
              name="Tutar"
              fill="#cdbd9d"
              radius={[3, 3, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

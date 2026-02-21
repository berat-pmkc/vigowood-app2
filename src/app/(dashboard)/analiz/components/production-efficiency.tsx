"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface EfficiencyData {
  istasyon: string;
  ortSureDk: number;
}

const STATION_COLORS: Record<string, string> = {
  Kesim: "#cdbd9d",
  Temizlik: "#3368b1",
  Montaj: "#f28a19",
  Paketleme: "#70c1aa",
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: EfficiencyData }>;
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-background p-3 shadow-md">
      <p className="mb-1 text-sm font-medium text-foreground">
        {item.istasyon}
      </p>
      <p className="text-sm text-muted-foreground">
        Ort. Süre:{" "}
        <span className="font-semibold text-foreground">
          {item.ortSureDk.toFixed(1)} dk
        </span>
      </p>
    </div>
  );
}

export function ProductionEfficiency({ data }: { data: EfficiencyData[] }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          İstasyon Verimliliği — Ort. Tamamlanma Süresi
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke="#a99c7d"
              strokeOpacity={0.2}
            />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#5e5747" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v} dk`}
            />
            <YAxis
              type="category"
              dataKey="istasyon"
              tick={{ fontSize: 12, fill: "#5e5747" }}
              tickLine={false}
              axisLine={false}
              width={70}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="ortSureDk" name="Ort. Süre" radius={[0, 4, 4, 0]} maxBarSize={28}>
              {data.map((entry) => (
                <Cell
                  key={entry.istasyon}
                  fill={STATION_COLORS[entry.istasyon] || "#a99c7d"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

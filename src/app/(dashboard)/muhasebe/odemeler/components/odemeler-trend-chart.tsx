"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface TrendItem {
  month: string;
  label: string;
  tamamlanan: number;
  bekleyen: number;
}

export function OdemelerTrendChart({ data }: { data: TrendItem[] }) {
  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Son 6 Ay Ödeme Trendi</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)
                }
              />
              <Tooltip
                formatter={(value, name) => [
                  new Intl.NumberFormat("tr-TR", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(Number(value)) + " ₺",
                  name === "tamamlanan" ? "Tamamlanan" : "Bekleyen",
                ]}
                labelFormatter={(_, payload) => {
                  if (payload?.[0]?.payload?.month) {
                    const d = new Date(payload[0].payload.month + "-01");
                    return d.toLocaleDateString("tr-TR", {
                      month: "long",
                      year: "numeric",
                    });
                  }
                  return "";
                }}
              />
              <Legend
                formatter={(value) =>
                  value === "tamamlanan" ? "Tamamlanan" : "Bekleyen"
                }
              />
              <Bar
                dataKey="tamamlanan"
                stackId="a"
                fill="#70c1aa"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="bekleyen"
                stackId="a"
                fill="#f28a19"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

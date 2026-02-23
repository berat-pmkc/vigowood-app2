"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BAR_COLORS = ["#3368b1", "#70c1aa", "#9333ea", "#f28a19", "#ea580c"];

interface PersonelChartsProps {
  trendData: { label: string; date: string; count: number }[];
  deptChartData: { name: string; value: number }[];
}

export function PersonelCharts({ trendData, deptChartData }: PersonelChartsProps) {
  return (
    <>
      {/* Trend Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Son 30 Gün Yoklama Trendi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  labelFormatter={(_, payload) => {
                    if (payload?.[0]?.payload?.date) {
                      return new Date(payload[0].payload.date).toLocaleDateString("tr-TR");
                    }
                    return "";
                  }}
                  formatter={(value) => [value ?? 0, "Kayıt"]}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#cdbd9d"
                  fill="#cdbd9d"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Department Distribution */}
      {deptChartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Bugün Departman Dağılımı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    width={120}
                  />
                  <Tooltip formatter={(value) => [value ?? 0, "Kişi"]} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {deptChartData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={BAR_COLORS[index % BAR_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

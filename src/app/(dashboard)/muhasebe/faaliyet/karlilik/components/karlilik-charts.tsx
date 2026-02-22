"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";

interface AggRow {
  marka: string;
  sira: number;
  kalem_turu: string;
  kalem: string;
  tl: number;
  usd: number;
}

interface TrendItem {
  donemKodu: string;
  donemLabel: string;
  gelir: number;
  gider: number;
  favok: number;
  genelKar: number;
}

interface Props {
  data: AggRow[];
  trendData: TrendItem[];
}

const COLORS = [
  "#cdbd9d", "#70c1aa", "#3368b1", "#f28a19", "#ee7683",
  "#a99c7d", "#5e5747", "#b1d286", "#6f4c37", "#adb5be",
];

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toFixed(0);
}

export function KarlilikCharts({ data, trendData }: Props) {
  // 1. Gelir dağılımı pie chart (GELIR kalem_turu)
  const gelirRows = data
    .filter((r) => r.kalem_turu === "GELIR" && r.tl > 0)
    .sort((a, b) => b.tl - a.tl);

  const pieData = gelirRows.map((r) => ({
    name: r.kalem,
    value: r.tl,
  }));

  // 2. Gider dağılımı bar chart (GIDER + FD_GIDER kalem_turu)
  const giderRows = data
    .filter((r) => (r.kalem_turu === "GIDER" || r.kalem_turu === "FD_GIDER") && r.tl > 0)
    .sort((a, b) => b.tl - a.tl);

  const barData = giderRows.map((r) => ({
    name: r.kalem.length > 20 ? r.kalem.slice(0, 18) + "..." : r.kalem,
    fullName: r.kalem,
    value: r.tl,
  }));

  if (pieData.length === 0 && trendData.length === 0 && barData.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Gelir Dağılımı Pie */}
      {pieData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gelir Dagilimi</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={(props) => {
                    const name = String((props as { name?: string }).name ?? "");
                    const percent = Number((props as { percent?: number }).percent ?? 0);
                    return `${name} (${(percent * 100).toFixed(0)}%)`;
                  }}
                  labelLine={false}
                >
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${formatCompact(Number(value ?? 0))} TL`, "Gelir"]}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* FAVÖK + Net Kâr Trend */}
      {trendData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Karlilik Trendi</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="donemLabel"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(v) => formatCompact(v)}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value, name) => [
                    `${formatCompact(Number(value ?? 0))} TL`,
                    String(name),
                  ]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="favok"
                  name="FAVOK"
                  stroke="#70c1aa"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="genelKar"
                  name="Net Kar"
                  stroke="#3368b1"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Gider Dağılımı Bar */}
      {barData.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Gider Dagilimi</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(250, barData.length * 35)}>
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ left: 20, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => formatCompact(v)}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={150}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value) => [`${formatCompact(Number(value ?? 0))} TL`, "Gider"]}
                  labelFormatter={(label) => {
                    const item = barData.find((d) => d.name === label);
                    return item?.fullName ?? label;
                  }}
                />
                <Bar dataKey="value" fill="#ee7683" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

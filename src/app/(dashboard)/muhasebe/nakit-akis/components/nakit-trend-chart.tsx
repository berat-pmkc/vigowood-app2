"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface TrendItem {
  donemKodu: string;
  girisTl: number;
  cikisTl: number;
  netTl: number;
}

export function NakitTrendChart({ data }: { data: TrendItem[] }) {
  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Nakit Akış Trendi</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis
                dataKey="donemKodu"
                tick={{ fontSize: 10 }}
                tickFormatter={(v: string) => {
                  const m = v.match(/^(\d{4})-(\d{1,2})-D(\d)$/);
                  if (!m) return v;
                  const months = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
                  return `${months[Number(m[2])-1]} D${m[3]}`;
                }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  v >= 1_000_000
                    ? `${(v / 1_000_000).toFixed(1)}M`
                    : v >= 1_000
                    ? `${(v / 1_000).toFixed(0)}K`
                    : String(v)
                }
              />
              <Tooltip
                formatter={(value, name) => {
                  const label =
                    name === "girisTl"
                      ? "Giriş"
                      : name === "cikisTl"
                      ? "Çıkış"
                      : "Net";
                  return [
                    new Intl.NumberFormat("tr-TR", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(Number(value)) + " ₺",
                    label,
                  ];
                }}
              />
              <Legend
                formatter={(value) =>
                  value === "girisTl"
                    ? "Giriş"
                    : value === "cikisTl"
                    ? "Çıkış"
                    : "Net"
                }
              />
              <Bar dataKey="girisTl" fill="#70c1aa" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="cikisTl" fill="#ee7683" radius={[4, 4, 0, 0]} barSize={20} />
              <Line
                type="monotone"
                dataKey="netTl"
                stroke="#3368b1"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { COLORS } from "@/lib/constants";

interface Props {
  data: {
    month: string;
    totalSales: number;
    totalCommission: number;
    netAmount: number;
  }[];
}

function formatTRY(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K ₺`;
  return `${value} ₺`;
}

export default function FinansChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        Veri bulunamadı
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
        <XAxis dataKey="month" fontSize={12} tickLine={false} />
        <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatTRY} />
        <Tooltip
          formatter={(value, name) => {
            const labels: Record<string, string> = {
              totalSales: "Satış",
              totalCommission: "Komisyon",
              netAmount: "Net Ödeme",
            };
            return [formatTRY(value as number), labels[name as string] || name];
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
              totalSales: "Satış",
              totalCommission: "Komisyon",
              netAmount: "Net Ödeme",
            };
            return labels[value] || value;
          }}
        />
        <Bar dataKey="totalSales" fill={COLORS.success} radius={[4, 4, 0, 0]} />
        <Bar dataKey="totalCommission" fill={COLORS.warning} radius={[4, 4, 0, 0]} />
        <Bar dataKey="netAmount" fill={COLORS.info} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

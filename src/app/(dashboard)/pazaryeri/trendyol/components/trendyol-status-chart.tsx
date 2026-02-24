"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ORDER_STATUS_LABELS } from "@/lib/trendyol/helpers";
import type { TrendyolOrderStatus } from "@/lib/trendyol/types";
import { COLORS } from "@/lib/constants";

const STATUS_HEX: Record<string, string> = {
  Created: "#3b82f6",
  Picking: "#f59e0b",
  Invoiced: "#6366f1",
  Shipped: "#a855f7",
  Delivered: "#10b981",
  Cancelled: "#ef4444",
  UnSupplied: "#f97316",
  Returned: "#f43f5e",
  UnDelivered: "#eab308",
  UnPacked: "#9ca3af",
  AtCollectionPoint: "#06b6d4",
  Awaiting: "#94a3b8",
};

interface Props {
  data: Record<string, number>;
}

export default function TrendyolStatusChart({ data }: Props) {
  const chartData = Object.entries(data)
    .map(([status, count]) => ({
      name: ORDER_STATUS_LABELS[status as TrendyolOrderStatus] || status,
      value: count,
      color: STATUS_HEX[status] || "#9ca3af",
    }))
    .sort((a, b) => b.value - a.value);

  if (chartData.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label={({ name, percent }: any) =>
            (percent ?? 0) > 0.05 ? `${String(name)} (${((percent ?? 0) * 100).toFixed(0)}%)` : ""
          }
          labelLine={false}
        >
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            `${value} sipariş`,
            String(name),
          ]}
          contentStyle={{
            borderRadius: "8px",
            border: `1px solid ${COLORS.side}`,
            fontSize: "13px",
          }}
        />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "12px" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

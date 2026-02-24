"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { PACKAGE_STATUS_LABELS } from "@/lib/ikas/helpers";
import type { IkasPackageStatus } from "@/lib/ikas/types";
import { COLORS } from "@/lib/constants";

const STATUS_HEX: Record<string, string> = {
  UNFULFILLED: "#3b82f6",
  FULFILLED: "#6366f1",
  PARTIALLY_FULFILLED: "#818cf8",
  READY_FOR_SHIPMENT: "#a855f7",
  PARTIALLY_READY_FOR_SHIPMENT: "#c084fc",
  DELIVERED: "#10b981",
  PARTIALLY_DELIVERED: "#34d399",
  CANCELLED: "#ef4444",
  PARTIALLY_CANCELLED: "#f87171",
  REFUNDED: "#f43f5e",
  PARTIALLY_REFUNDED: "#fb7185",
  REFUND_REQUESTED: "#f59e0b",
  REFUND_REJECTED: "#94a3b8",
  UNABLE_TO_DELIVER: "#eab308",
  REFUND_REQUEST_ACCEPTED: "#fbbf24",
  CANCEL_REQUESTED: "#f97316",
  CANCEL_REJECTED: "#9ca3af",
};

interface Props {
  data: Record<string, number>;
}

export default function StatusDistributionChart({ data }: Props) {
  const chartData = Object.entries(data)
    .map(([status, count]) => ({
      name: PACKAGE_STATUS_LABELS[status as IkasPackageStatus] || status,
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

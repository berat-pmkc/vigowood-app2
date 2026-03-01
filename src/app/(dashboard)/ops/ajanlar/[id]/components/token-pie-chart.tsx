"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface TokenPieChartProps {
  inputTokens: number;
  outputTokens: number;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

const COLORS = ["#3368b1", "#f28a19"];

export function TokenPieChart({ inputTokens, outputTokens }: TokenPieChartProps) {
  const data = [
    { name: "Input", value: inputTokens },
    { name: "Output", value: outputTokens },
  ];

  if (inputTokens === 0 && outputTokens === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        Henüz token kullanımı yok
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={5}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [formatTokens(Number(value)), ""]} />
        <Legend
          formatter={(value: string) => (
            <span className="text-xs">{value === "Input" ? "Giriş" : "Çıkış"}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

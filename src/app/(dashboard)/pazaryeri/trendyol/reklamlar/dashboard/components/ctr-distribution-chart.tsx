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

interface Props {
  data: { name: string; ctr: number; cvr: number }[];
}

export default function CtrDistributionChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ left: 0, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10 }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `%${v}`} />
        <Tooltip
          formatter={(value, name) => [
            `%${Number(value).toFixed(2)}`,
            String(name),
          ]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend />
        <Bar dataKey="ctr" name="CTR" fill="#3368b1" radius={[4, 4, 0, 0]} />
        <Bar dataKey="cvr" name="CVR" fill="#f28a19" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

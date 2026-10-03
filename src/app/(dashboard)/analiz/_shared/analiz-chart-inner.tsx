"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalizChartProps } from "./analiz-chart";

const PALETTE = ["#3368b1", "#70c1aa", "#f28a19", "#ee7683", "#8d9d70", "#6f4c37"];

function nf(v: unknown, unit?: string): string {
  if (typeof v !== "number") return String(v ?? "");
  const s = v.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  return unit ? `${s}${unit}` : s;
}

export default function AnalizChartInner({
  type = "bar",
  data,
  xKey,
  series,
  layout = "horizontal",
  height = 300,
  unit,
  stacked,
}: AnalizChartProps) {
  const vertical = layout === "vertical";
  const margin = { top: 8, right: 12, left: vertical ? 8 : -8, bottom: 0 };
  const common = { data, margin };

  const axes = vertical ? (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#a99c7d33" horizontal={false} />
      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => nf(v)} />
      <YAxis type="category" dataKey={xKey} tick={{ fontSize: 11 }} width={110} interval={0} />
    </>
  ) : (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#a99c7d33" vertical={false} />
      <XAxis dataKey={xKey} tick={{ fontSize: 11 }} minTickGap={12} />
      <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => nf(v)} />
      {series.some((s) => s.yAxisId === "right") && (
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => nf(v)} />
      )}
    </>
  );

  const tooltip = (
    <Tooltip
      formatter={(v, name) => [nf(v, unit), name]}
      contentStyle={{ borderRadius: 8, fontSize: 12 }}
    />
  );
  const legend = series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null;
  const yId = (s: AnalizChartProps["series"][number]) => (vertical ? undefined : (s.yAxisId ?? "left"));
  const color = (i: number, c?: string) => c ?? PALETTE[i % PALETTE.length];

  let chart;
  if (type === "line") {
    chart = (
      <LineChart {...common}>
        {axes}
        {tooltip}
        {legend}
        {series.map((s, i) => (
          <Line
            key={s.key}
            yAxisId={yId(s)}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={color(i, s.color)}
            strokeWidth={2}
            dot={data.length <= 31}
            connectNulls
          />
        ))}
      </LineChart>
    );
  } else if (type === "area") {
    chart = (
      <AreaChart {...common}>
        {axes}
        {tooltip}
        {legend}
        {series.map((s, i) => (
          <Area
            key={s.key}
            yAxisId={yId(s)}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={color(i, s.color)}
            fill={color(i, s.color)}
            fillOpacity={0.25}
            stackId={stacked ? "a" : undefined}
          />
        ))}
      </AreaChart>
    );
  } else if (type === "composed") {
    chart = (
      <ComposedChart {...common}>
        {axes}
        {tooltip}
        {legend}
        {series.map((s, i) =>
          s.type === "line" ? (
            <Line
              key={s.key}
              yAxisId={yId(s)}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={color(i, s.color)}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ) : (
            <Bar
              key={s.key}
              yAxisId={yId(s)}
              dataKey={s.key}
              name={s.label}
              fill={color(i, s.color)}
              radius={[3, 3, 0, 0]}
              stackId={stacked ? "a" : undefined}
            />
          ),
        )}
      </ComposedChart>
    );
  } else {
    chart = (
      <BarChart {...common} layout={vertical ? "vertical" : "horizontal"}>
        {axes}
        {tooltip}
        {legend}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            yAxisId={yId(s)}
            dataKey={s.key}
            name={s.label}
            fill={color(i, s.color)}
            radius={vertical ? [0, 3, 3, 0] : [3, 3, 0, 0]}
            stackId={stacked ? "a" : undefined}
          />
        ))}
      </BarChart>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      {chart}
    </ResponsiveContainer>
  );
}

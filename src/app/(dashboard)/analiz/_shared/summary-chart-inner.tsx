"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SummaryChartProps, SummaryItem, SummaryUnit } from "./summary-chart";

const CUR = "#5e5747";
const PREV = "#cdbd9d";

function fmt(v: number | null, unit: SummaryUnit, compact = false): string {
  if (v === null) return "—";
  const s = v.toLocaleString("tr-TR", { maximumFractionDigits: unit === "dk" ? 1 : unit === "%" ? 1 : 0 });
  if (unit === "%") return `%${s}`;
  if (compact) return s;
  return `${s} ${unit}`;
}

interface Row extends SummaryItem {
  curH: number;
  prevH: number | null;
}

function SummaryTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  if (r.muted) return null;
  let change: React.ReactNode = null;
  if (r.prev !== null && r.cur !== null && r.prev !== 0) {
    const pct = ((r.cur - r.prev) / r.prev) * 100;
    const good = r.lowerBetter ? pct < 0 : pct > 0;
    const bad = r.lowerBetter ? pct > 0 : pct < 0;
    const color = good ? "#3caa35" : bad ? "#ee7683" : "#5e5747";
    change = (
      <div className="mt-1 font-semibold" style={{ color }}>
        Değişim: {pct > 0 ? "+" : ""}
        {pct.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-[#a99c7d]/40 bg-white px-3 py-2 text-xs shadow">
      <div className="mb-1 font-semibold text-[#474237]">{r.label}</div>
      <div style={{ color: CUR }}>Bu dönem: {fmt(r.cur, r.unit)}</div>
      {r.prev !== null && <div className="text-[#a99c7d]">Önceki dönem: {fmt(r.prev, r.unit)}</div>}
      {change}
    </div>
  );
}

export default function SummaryChartInner({ items, hasPrev, query }: Omit<SummaryChartProps, "title">) {
  const router = useRouter();
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const upd = () => setMobile(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  const data: Row[] = items.map((it) => {
    const c = it.muted ? 0 : (it.cur ?? 0);
    const p = hasPrev && !it.muted ? (it.prev ?? 0) : 0;
    const max = Math.max(c, p);
    return {
      ...it,
      curH: max > 0 ? (c / max) * 100 : 0,
      prevH: hasPrev && !it.muted && it.prev !== null ? (max > 0 ? (p / max) * 100 : 0) : null,
    };
  });

  const go = (row: Row) => router.push(`${row.href}${query ? `?${query}` : ""}`);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 22, right: 4, left: 4, bottom: 0 }} barGap={2} barCategoryGap={mobile ? "12%" : "22%"}>
        <CartesianGrid strokeDasharray="3 3" stroke="#a99c7d33" vertical={false} />
        <XAxis
          dataKey="label"
          interval={0}
          tick={{ fontSize: mobile ? 10 : 12 }}
          tickFormatter={(_v, i) => (mobile ? data[i]?.short : data[i]?.label) ?? ""}
        />
        <YAxis hide domain={[0, 112]} />
        <Tooltip content={<SummaryTooltip />} cursor={{ fill: "#a99c7d1a" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          dataKey="curH"
          name="Bu dönem"
          fill={CUR}
          radius={[3, 3, 0, 0]}
          cursor="pointer"
          onClick={(d) => go(d as unknown as Row)}
        >
          <LabelList
            dataKey="curH"
            position="top"
            content={(p) => {
              const { x, y, width, index } = p as unknown as { x: number; y: number; width: number; index: number };
              const r = data[index];
              if (!r || r.muted) return null;
              return (
                <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={mobile ? 9 : 11} fontWeight={600} fill="#474237">
                  {fmt(r.cur, r.unit, mobile)}
                </text>
              );
            }}
          />
        </Bar>
        {hasPrev && (
          <Bar
            dataKey="prevH"
            name="Önceki dönem"
            fill={PREV}
            fillOpacity={0.6}
            radius={[3, 3, 0, 0]}
            cursor="pointer"
            onClick={(d) => go(d as unknown as Row)}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

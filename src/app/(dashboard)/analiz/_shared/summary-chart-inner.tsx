"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SummaryChartProps, SummaryItem, SummaryUnit } from "./summary-chart";

const CUR = "#5e5747";

function fmt(v: number | null, unit: SummaryUnit, compact = false): string {
  if (v === null) return "—";
  const s = v.toLocaleString("tr-TR", { maximumFractionDigits: unit === "dk" || unit === "sa" || unit === "%" ? 1 : 0 });
  if (unit === "%") return `%${s}`;
  if (compact) return s;
  return `${s} ${unit}`;
}

/** Önceki döneme göre değişim (%); karşılaştırılamıyorsa null */
function changeOf(r: SummaryItem, hasPrev: boolean): { pct: number; color: string } | null {
  if (!hasPrev || r.muted || r.prev === null || r.cur === null || r.prev === 0) return null;
  const pct = Math.round((((r.cur - r.prev) / r.prev) * 100) * 10) / 10;
  const good = r.lowerBetter ? pct < 0 : pct > 0;
  const bad = r.lowerBetter ? pct > 0 : pct < 0;
  return { pct, color: good ? "#3caa35" : bad ? "#ee7683" : "#5e5747" };
}

interface Row extends SummaryItem {
  curH: number;
}

function SummaryTooltip({ active, payload, hasPrev }: { active?: boolean; payload?: { payload: Row }[]; hasPrev: boolean }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  if (r.muted) return null;
  const ch = changeOf(r, hasPrev);
  return (
    <div className="rounded-lg border border-[#a99c7d]/40 bg-white px-3 py-2 text-xs shadow">
      <div className="mb-1 font-semibold text-[#474237]">{r.label}</div>
      <div style={{ color: CUR }}>Bu dönem: {fmt(r.cur, r.unit)}</div>
      {hasPrev && r.prev !== null && <div className="text-[#a99c7d]">Önceki dönem: {fmt(r.prev, r.unit)}</div>}
      {ch && (
        <div className="mt-1 font-semibold" style={{ color: ch.color }}>
          Değişim: {ch.pct > 0 ? "+" : ""}
          {ch.pct.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%
        </div>
      )}
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

  // Yükseklik: değer / max(değer, önceki dönem değeri); önceki yoksa 100
  const data: Row[] = items.map((it) => {
    const c = it.muted ? 0 : (it.cur ?? 0);
    const p = hasPrev && !it.muted && it.prev ? it.prev : 0;
    const max = Math.max(c, p);
    return { ...it, curH: max > 0 ? (c / max) * 100 : it.muted ? 0 : c > 0 ? 100 : 0 };
  });

  const go = (row: Row) => {
    if (!row.href) return;
    router.push(`${row.href}${query ? `?${query}` : ""}`);
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 22, right: 4, left: 4, bottom: 0 }} barCategoryGap={mobile ? "12%" : "22%"}>
        <CartesianGrid strokeDasharray="3 3" stroke="#a99c7d33" vertical={false} />
        <XAxis
          dataKey="label"
          interval={0}
          height={46}
          tick={(p: { x?: number | string; y?: number | string; index?: number }) => {
            const r = data[p.index ?? -1];
            if (!r) return <g />;
            const ch = changeOf(r, hasPrev);
            return (
              <g transform={`translate(${p.x},${p.y})`}>
                <text y={14} textAnchor="middle" fontSize={mobile ? 10 : 12} fill="#666">
                  {mobile ? r.short : r.label}
                </text>
                {ch && (
                  <text y={31} textAnchor="middle" fontSize={mobile ? 10 : 11} fontWeight={600} fill={ch.color}>
                    {ch.pct === 0 ? "%0" : `${ch.pct > 0 ? "▲" : "▼"} %${Math.abs(ch.pct).toLocaleString("tr-TR")}`}
                  </text>
                )}
              </g>
            );
          }}
        />
        <YAxis hide domain={[0, 112]} />
        <Tooltip content={<SummaryTooltip hasPrev={hasPrev} />} cursor={{ fill: "#a99c7d1a" }} />
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
      </BarChart>
    </ResponsiveContainer>
  );
}

"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { MakineYuk, MdfSatiri, PlakaPareto } from "../../actions";

const MAKINE_RENK: Record<string, string> = {
  "MAK-1": "#3368b1", "MAK-2": "#70c1aa", "MAK-3": "#f28a19",
};

type IpucuP = {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ name?: string; value?: number; dataKey?: string }>;
};

function Ipucu({ active, label, payload, birim }: IpucuP & { birim: "saat" | "plaka" | "pareto" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-2 text-xs shadow-sm">
      {label != null && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((p, i) => {
        let deger: string;
        if (birim === "plaka") deger = `${Number(p.value).toLocaleString("tr-TR")} plaka`;
        else if (p.dataKey === "kumulatif") deger = `%${Number(p.value).toFixed(1)}`;
        else deger = `${p.value} saat`;
        return <p key={i} className="text-muted-foreground">{p.name}: <b>{deger}</b></p>;
      })}
    </div>
  );
}

export function KesimRaporGrafik({
  tip, makine, mdf, pareto,
}: {
  tip: "makine" | "mdf" | "pareto";
  makine?: MakineYuk[];
  mdf?: MdfSatiri[];
  pareto?: PlakaPareto[];
}) {
  if (tip === "makine" && makine) {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={makine} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e3dc" />
          <XAxis dataKey="makine" tick={{ fontSize: 12 }} stroke="#5e5747" />
          <YAxis tick={{ fontSize: 11 }} stroke="#5e5747"
                 label={{ value: "saat", angle: -90, position: "insideLeft", fontSize: 11 }} />
          <Tooltip content={<Ipucu birim="saat" />} />
          <Bar dataKey="saat" name="Planlı makine-saati" radius={[4, 4, 0, 0]}>
            {makine.map((m) => (
              <Cell key={m.makine} fill={MAKINE_RENK[m.makine] ?? "#a99c7d"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (tip === "mdf" && mdf) {
    const d = mdf.slice(0, 10);
    return (
      <ResponsiveContainer width="100%" height={Math.max(180, d.length * 34)}>
        <BarChart data={d} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e3dc" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} stroke="#5e5747" />
          <YAxis type="category" dataKey="ad" width={120} tick={{ fontSize: 11 }} stroke="#5e5747" />
          <Tooltip content={<Ipucu birim="plaka" />} />
          <Bar dataKey="plaka" name="Plaka" fill="#cdbd9d" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (tip === "pareto" && pareto) {
    const d = pareto.slice(0, 12);
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={d} margin={{ top: 8, right: 12, left: -8, bottom: 56 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e3dc" />
          <XAxis dataKey="ad" tick={{ fontSize: 10 }} stroke="#5e5747"
                 angle={-35} textAnchor="end" interval={0} height={70} />
          <YAxis yAxisId="l" tick={{ fontSize: 11 }} stroke="#5e5747"
                 label={{ value: "saat", angle: -90, position: "insideLeft", fontSize: 11 }} />
          <YAxis yAxisId="r" orientation="right" domain={[0, 100]}
                 tick={{ fontSize: 11 }} stroke="#a99c7d" unit="%" />
          <Tooltip content={<Ipucu birim="pareto" />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="l" dataKey="saat" name="Planlı makine-saati"
               fill="#8d9d70" radius={[4, 4, 0, 0]} />
          <Line yAxisId="r" type="monotone" dataKey="kumulatif" name="Kümülatif %"
                stroke="#ee7683" strokeWidth={2.5} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  return null;
}

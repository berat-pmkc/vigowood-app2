"use client";

import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import type { ParetoSatiri, KisiSatiri } from "../actions";

/**
 * Analiz grafikleri tek dosyada — hepsi recharts kullanıyor ve bu dosya
 * next/dynamic ile ssr:false yükleniyor, sayfa açılışını bekletmesin.
 */

/**
 * Özel tooltip. recharts'ın formatter prop'u bu sürümde katı tiplenmiş,
 * proje genelinde de özel bileşen tercih edilmiş — aynı kalıp.
 */
function Ipucu({
  active, payload, label, birim, etiketOn,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
  label?: string | number;
  birim: "dk" | "adet";
  etiketOn?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-2 text-xs shadow-sm">
      <p className="mb-1 font-medium">{etiketOn ? `${label} ${etiketOn}` : label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}:{" "}
          <b>
            {p.dataKey === "kumulatif"
              ? `%${Number(p.value ?? 0).toFixed(1)}`
              : birim === "dk"
                ? `${Number(p.value ?? 0).toLocaleString("tr-TR")} dk`
                : Number(p.value ?? 0).toLocaleString("tr-TR")}
          </b>
        </p>
      ))}
    </div>
  );
}

export function PaketlemeAnalizGrafik({
  tip, veri,
}: {
  tip: "pareto" | "adet" | "kisi";
  veri: ParetoSatiri[] | KisiSatiri[];
}) {
  if (tip === "kisi") {
    const d = veri as KisiSatiri[];
    return (
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={d} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e3dc" />
          <XAxis
            dataKey="kisi" tickFormatter={(v) => `${v} kişi`}
            tick={{ fontSize: 11 }} stroke="#5e5747"
          />
          <YAxis yAxisId="l" tick={{ fontSize: 11 }} stroke="#5e5747"
                 label={{ value: "dk", angle: -90, position: "insideLeft", fontSize: 11 }} />
          <Tooltip content={<Ipucu birim="dk" etiketOn="kişi" />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="l" dataKey="birimDk" name="Birim süre (dk/adet/kişi)"
               fill="#3368b1" radius={[4, 4, 0, 0]} />
          <Line yAxisId="l" type="monotone" dataKey="gercekDk"
                name="Gerçek süre (dk/adet)" stroke="#f28a19" strokeWidth={2.5}
                dot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  const d = (veri as ParetoSatiri[]).slice(0, 12);

  if (tip === "adet") {
    const sirali = [...d].sort((a, b) => b.adet - a.adet);
    return (
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={sirali} margin={{ top: 8, right: 12, left: -8, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e3dc" />
          <XAxis dataKey="sku" tick={{ fontSize: 10 }} stroke="#5e5747"
                 angle={-40} textAnchor="end" interval={0} height={60} />
          <YAxis tick={{ fontSize: 11 }} stroke="#5e5747" />
          <Tooltip content={<Ipucu birim="adet" />} />
          <Bar dataKey="adet" name="Paketlenen adet" fill="#70c1aa" radius={[4, 4, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={d} margin={{ top: 8, right: 12, left: -8, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e3dc" />
        <XAxis dataKey="sku" tick={{ fontSize: 10 }} stroke="#5e5747"
               angle={-40} textAnchor="end" interval={0} height={60} />
        <YAxis yAxisId="l" tick={{ fontSize: 11 }} stroke="#5e5747" />
        <YAxis yAxisId="r" orientation="right" domain={[0, 100]}
               tick={{ fontSize: 11 }} stroke="#a99c7d" unit="%" />
        <Tooltip content={<Ipucu birim="dk" />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="l" dataKey="iscilikDk" name="İşçilik (dk)"
             fill="#cdbd9d" radius={[4, 4, 0, 0]} />
        <Line yAxisId="r" type="monotone" dataKey="kumulatif" name="Kümülatif %"
              stroke="#ee7683" strokeWidth={2.5} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

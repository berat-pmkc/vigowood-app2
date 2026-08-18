"use client";

import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { Cell } from "recharts";
import type { ParetoSatiri, KisiSatiri, EkipSatiri } from "../actions";

/**
 * Analiz grafikleri tek dosyada — hepsi recharts kullanıyor ve bu dosya
 * next/dynamic ile ssr:false yükleniyor, sayfa açılışını bekletmesin.
 */


/**
 * Uzun etiketleri okunur kılan tick.
 *
 * "BÜYÜK KOS GRUBU" gibi adlar 45 derece eğik yazılınca hem grafiğe
 * taşıyor hem okunmuyordu. Burada metin kelimelerden bölünüp en fazla
 * iki satıra yayılıyor, taşarsa kısaltılıyor.
 */
function EgikEtiket({ x, y, payload }: {
  x?: number; y?: number; payload?: { value?: string | number };
}) {
  const ham = String(payload?.value ?? "");
  const kelimeler = ham.split(" ");
  const satirlar: string[] = [];
  let mevcut = "";
  for (const k of kelimeler) {
    if ((mevcut + " " + k).trim().length <= 12) mevcut = (mevcut + " " + k).trim();
    else { if (mevcut) satirlar.push(mevcut); mevcut = k; }
  }
  if (mevcut) satirlar.push(mevcut);
  const gosterilecek = satirlar.slice(0, 2);
  if (satirlar.length > 2) gosterilecek[1] = gosterilecek[1].slice(0, 10) + "…";

  return (
    <g transform={`translate(${x},${y})`}>
      <text transform="rotate(-35)" textAnchor="end" fill="#474237" fontSize={11}>
        {gosterilecek.map((satir, i) => (
          <tspan key={i} x={0} dy={i === 0 ? 10 : 12}>{satir}</tspan>
        ))}
      </text>
    </g>
  );
}

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
  birim: "dk" | "adet" | "endeks";
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
              : birim === "endeks"
                ? Number(p.value ?? 0).toFixed(2)
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
  tip: "pareto" | "adet" | "kisi" | "ekip";
  veri: ParetoSatiri[] | KisiSatiri[] | EkipSatiri[];
}) {
  if (tip === "ekip") {
    const d = veri as EkipSatiri[];
    return (
      <ResponsiveContainer width="100%" height={Math.max(240, d.length * 42)}>
        <ComposedChart data={d} layout="vertical"
                       margin={{ top: 8, right: 28, left: 150, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e3dc" />
          <XAxis type="number" domain={[0, "auto"]} tick={{ fontSize: 12 }} stroke="#474237" />
          <YAxis type="category" dataKey="ekip" width={146}
                 tick={{ fontSize: 11 }} stroke="#474237" />
          <Tooltip content={<Ipucu birim="endeks" />} />
          <Bar dataKey="endeks" name="İşçilik endeksi" radius={[0, 4, 4, 0]}>
            {d.map((e, i) => (
              // 1'in altı ortalamadan verimli, üstü değil
              <Cell key={i} fill={e.endeks <= 1 ? "#70c1aa" : "#ee7683"} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (tip === "kisi") {
    const d = veri as KisiSatiri[];
    return (
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={d} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e3dc" />
          <XAxis
            dataKey="kisi" tickFormatter={(v) => `${v} kişi`}
            tick={{ fontSize: 12 }} stroke="#474237"
          />
          <YAxis yAxisId="l" tick={{ fontSize: 12 }} stroke="#474237"
                 label={{ value: "dk", angle: -90, position: "insideLeft", fontSize: 11 }} />
          <Tooltip content={<Ipucu birim="dk" etiketOn="kişi" />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
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
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={sirali} margin={{ top: 8, right: 12, left: -8, bottom: 56 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e3dc" />
          <XAxis dataKey="sku" stroke="#5e5747" interval={0} height={86}
                 tick={<EgikEtiket />} />
          <YAxis tick={{ fontSize: 12 }} stroke="#474237" />
          <Tooltip content={<Ipucu birim="adet" />} />
          <Bar dataKey="adet" name="Paketlenen adet" fill="#70c1aa" radius={[4, 4, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={d} margin={{ top: 8, right: 12, left: -8, bottom: 56 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e3dc" />
        <XAxis dataKey="sku" stroke="#5e5747" interval={0} height={86}
               tick={<EgikEtiket />} />
        <YAxis yAxisId="l" tick={{ fontSize: 12 }} stroke="#474237" />
        <YAxis yAxisId="r" orientation="right" domain={[0, 100]}
               tick={{ fontSize: 11 }} stroke="#a99c7d" unit="%" />
        <Tooltip content={<Ipucu birim="dk" />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="l" dataKey="iscilikDk" name="İşçilik (dk)"
             fill="#cdbd9d" radius={[4, 4, 0, 0]} />
        <Line yAxisId="r" type="monotone" dataKey="kumulatif" name="Kümülatif %"
              stroke="#ee7683" strokeWidth={2.5} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

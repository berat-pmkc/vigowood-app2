"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface GenelBakisData {
  varlikAcilisTl: number;
  varlikAcilisUsd: number;
  nakitGirisTl: number;
  nakitGirisUsd: number;
  nakitCikisTl: number;
  nakitCikisUsd: number;
  varlikTl: number;
  varlikUsd: number;
  yatirimTl: number;
  toplamVarlikTl: number;
  gayrinakitIslem: number;
  toplamPiyasaBorcu: number;
  toplamKkBorc: number;
  toplamFinansalBorc: number;
  kurBilgisi: number;
}

interface PrevDonemData {
  nakitGirisTl?: number;
  nakitCikisTl?: number;
  varlikTl?: number;
  toplamVarlikTl?: number;
}

function pctChange(current: number, prev: number | undefined): string | null {
  if (prev == null || prev === 0) return null;
  const pct = ((current - prev) / Math.abs(prev)) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export function GenelBakisTable({
  data,
  prevDonem,
}: {
  data: GenelBakisData;
  prevDonem?: PrevDonemData;
}) {
  const toplamBorc = data.toplamPiyasaBorcu + data.toplamKkBorc + data.toplamFinansalBorc;
  const netPozisyon = data.toplamVarlikTl - toplamBorc;
  const netTlAkis = data.nakitGirisTl - data.nakitCikisTl;

  const rows = [
    { label: "Açılış Varlık (TL)", value: formatCurrency(data.varlikAcilisTl, "TL") },
    { label: "Açılış Varlık (USD)", value: formatCurrency(data.varlikAcilisUsd, "USD") },
    {
      label: "Nakit Giriş (TL)",
      value: formatCurrency(data.nakitGirisTl, "TL"),
      change: pctChange(data.nakitGirisTl, prevDonem?.nakitGirisTl),
      highlight: true,
    },
    { label: "Nakit Giriş (USD)", value: formatCurrency(data.nakitGirisUsd, "USD") },
    {
      label: "Nakit Çıkış (TL)",
      value: formatCurrency(data.nakitCikisTl, "TL"),
      change: pctChange(data.nakitCikisTl, prevDonem?.nakitCikisTl),
      highlight: true,
    },
    { label: "Nakit Çıkış (USD)", value: formatCurrency(data.nakitCikisUsd, "USD") },
    {
      label: "Net TL Akış",
      value: formatCurrency(netTlAkis, "TL"),
      bold: true,
      color: netTlAkis >= 0 ? "text-vw-success" : "text-vw-error",
    },
    { label: "Kapanış Varlık (TL)", value: formatCurrency(data.varlikTl, "TL") },
    { label: "Kapanış Varlık (USD)", value: formatCurrency(data.varlikUsd, "USD") },
    { label: "Yatırım (TL)", value: formatCurrency(data.yatirimTl, "TL") },
    {
      label: "Toplam Varlık (TL)",
      value: formatCurrency(data.toplamVarlikTl, "TL"),
      bold: true,
    },
    { label: "Gayrinakit İşlem", value: formatCurrency(data.gayrinakitIslem, "TL") },
    {
      label: "Toplam Borç",
      value: formatCurrency(toplamBorc, "TL"),
      bold: true,
      color: "text-vw-error",
    },
    {
      label: "Net Pozisyon",
      value: formatCurrency(netPozisyon, "TL"),
      bold: true,
      color: netPozisyon >= 0 ? "text-vw-success" : "text-vw-error",
    },
    { label: "USD/TRY Kur", value: data.kurBilgisi ? data.kurBilgisi.toFixed(4) : "—" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Genel Bakış</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between px-4 py-2.5"
            >
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm tabular-nums ${
                    row.bold ? "font-semibold" : "font-medium"
                  } ${"color" in row && row.color ? row.color : "text-foreground"}`}
                >
                  {row.value}
                </span>
                {"change" in row && row.change && (
                  <span
                    className={`text-xs ${
                      row.change.startsWith("+")
                        ? "text-vw-success"
                        : "text-vw-error"
                    }`}
                  >
                    {row.change}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

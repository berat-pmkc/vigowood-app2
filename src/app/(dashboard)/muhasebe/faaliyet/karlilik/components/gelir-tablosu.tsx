"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AggRow {
  marka: string;
  sira: number;
  kalem_turu: string;
  kalem: string;
  tl: number;
  usd: number;
}

interface Props {
  data: AggRow[];
  prevData: AggRow[];
  prevLabel: string;
  label: string;
}

function formatNum(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getDiffPct(current: number, prev: number): string | null {
  if (prev === 0) return null;
  const pct = ((current - prev) / Math.abs(prev)) * 100;
  return pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;
}

export function GelirTablosu({ data, prevData, prevLabel, label }: Props) {
  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Bu donem icin karlilik verisi bulunamadi.
        </CardContent>
      </Card>
    );
  }

  // Group by section
  const gelirRows = data.filter((r) => r.kalem_turu === "GELIR");
  const giderRows = data.filter((r) => r.kalem_turu === "GIDER");
  const fdGelirRows = data.filter((r) => r.kalem_turu === "FD_GELIR");
  const fdGiderRows = data.filter((r) => r.kalem_turu === "FD_GIDER");

  const getPrevVal = (kalem: string) =>
    prevData.find((r) => r.kalem === kalem)?.tl;

  const renderRow = (row: AggRow, indent = false) => {
    const prevVal = getPrevVal(row.kalem);
    const diffStr = prevVal !== undefined ? getDiffPct(row.tl, prevVal) : null;

    const isToplam = row.kalem_turu === "TOPLAM";
    const isKar = row.kalem_turu === "KAR";
    const isMarj = row.kalem_turu === "MARJ";
    const isGider = row.kalem_turu === "GIDER" || row.kalem_turu === "FD_GIDER";

    return (
      <tr
        key={`${row.kalem_turu}-${row.kalem}`}
        className={cn(
          "border-b",
          isToplam && "bg-muted/50 font-semibold",
          isKar && "font-bold",
        )}
      >
        <td
          className={cn(
            "p-2 text-sm",
            indent && "pl-6",
            isMarj && "italic text-muted-foreground",
            isKar && (row.tl >= 0 ? "text-vw-success" : "text-vw-error"),
          )}
        >
          {row.kalem}
        </td>
        <td
          className={cn(
            "p-2 text-right text-sm tabular-nums",
            isGider && "text-vw-error",
            isKar && (row.tl >= 0 ? "text-vw-success" : "text-vw-error"),
          )}
        >
          {isMarj ? `%${row.tl.toFixed(1)}` : `${formatNum(row.tl)} TL`}
        </td>
        <td className="p-2 text-right text-sm tabular-nums text-muted-foreground">
          {isMarj ? "" : `${formatNum(row.usd)} $`}
        </td>
        {prevData.length > 0 && (
          <td className="p-2 text-right text-xs">
            {diffStr && (
              <span
                className={cn(
                  diffStr.startsWith("+") ? "text-vw-success" : "text-vw-error"
                )}
              >
                {diffStr}
              </span>
            )}
          </td>
        )}
      </tr>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label} - Gelir Tablosu</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="p-2">Kalem</th>
                <th className="p-2 text-right">TL</th>
                <th className="p-2 text-right">USD</th>
                {prevData.length > 0 && (
                  <th className="p-2 text-right">vs {prevLabel}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {/* Faaliyet Gelirleri */}
              {gelirRows.length > 0 && (
                <tr className="bg-vw-success/5">
                  <td colSpan={prevData.length > 0 ? 4 : 3} className="p-2 text-xs font-semibold text-vw-success">
                    Faaliyet Gelirleri
                  </td>
                </tr>
              )}
              {gelirRows.map((r) => renderRow(r, true))}

              {/* TOPLAM FAALİYET GELİRİ */}
              {data.filter((r) => r.kalem === "TOPLAM FAALİYET GELİRİ").map((r) => renderRow(r))}

              {/* Faaliyet Giderleri */}
              {giderRows.length > 0 && (
                <tr className="bg-vw-error/5">
                  <td colSpan={prevData.length > 0 ? 4 : 3} className="p-2 text-xs font-semibold text-vw-error">
                    Faaliyet Giderleri
                  </td>
                </tr>
              )}
              {giderRows.map((r) => renderRow(r, true))}

              {/* TOPLAM FAALİYET GİDERİ */}
              {data.filter((r) => r.kalem === "TOPLAM FAALİYET GİDERİ").map((r) => renderRow(r))}

              {/* FAVÖK + Marj */}
              {data.filter((r) => r.kalem === "FAALİYET KARI (FAVÖK)").map((r) => renderRow(r))}
              {data.filter((r) => r.kalem === "FAVÖK Marjı").map((r) => renderRow(r))}

              {/* FD Gelir */}
              {fdGelirRows.length > 0 && (
                <tr className="bg-muted/30">
                  <td colSpan={prevData.length > 0 ? 4 : 3} className="p-2 text-xs font-semibold text-muted-foreground">
                    Faaliyet Disi Gelirler
                  </td>
                </tr>
              )}
              {fdGelirRows.map((r) => renderRow(r, true))}

              {/* FD Gider */}
              {fdGiderRows.length > 0 && (
                <tr className="bg-muted/30">
                  <td colSpan={prevData.length > 0 ? 4 : 3} className="p-2 text-xs font-semibold text-muted-foreground">
                    Faaliyet Disi Giderler
                  </td>
                </tr>
              )}
              {fdGiderRows.map((r) => renderRow(r, true))}

              {/* GENEL KAR + Marj */}
              {data.filter((r) => r.kalem === "GENEL KAR").map((r) => renderRow(r))}
              {data.filter((r) => r.kalem === "Genel Kâr Marjı").map((r) => renderRow(r))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

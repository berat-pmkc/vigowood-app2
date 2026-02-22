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
  vwData: AggRow[];
  hmData: AggRow[];
  label: string;
}

function formatNum(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function MarkaKarsilastirma({ vwData, hmData, label }: Props) {
  if (vwData.length === 0 && hmData.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Karsilastirma verisi bulunamadi.
        </CardContent>
      </Card>
    );
  }

  // Key metrics to compare
  const metrics = [
    { kalem: "TOPLAM FAALİYET GELİRİ", label: "Toplam Gelir" },
    { kalem: "TOPLAM FAALİYET GİDERİ", label: "Toplam Gider" },
    { kalem: "FAALİYET KARI (FAVÖK)", label: "FAVOK" },
    { kalem: "FAVÖK Marjı", label: "FAVOK Marji %" },
    { kalem: "GENEL KAR", label: "Genel Kar" },
    { kalem: "Genel Kâr Marjı", label: "Genel Kar Marji %" },
  ];

  const getVal = (data: AggRow[], kalem: string) =>
    data.find((r) => r.kalem === kalem)?.tl ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Marka Karsilastirma - {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="p-2">Gosterge</th>
                <th className="p-2 text-right">VIGO WOOD</th>
                <th className="p-2 text-right">HAS-MOB</th>
                <th className="p-2 text-right">Fark</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => {
                const vwVal = getVal(vwData, m.kalem);
                const hmVal = getVal(hmData, m.kalem);
                const isMarj = m.kalem.includes("Marj");
                const isKar = m.kalem.includes("KAR") || m.kalem.includes("FAVÖK");
                const diff = vwVal - hmVal;

                return (
                  <tr key={m.kalem} className="border-b">
                    <td className="p-2 text-sm font-medium">{m.label}</td>
                    <td
                      className={cn(
                        "p-2 text-right text-sm tabular-nums",
                        isKar && (vwVal >= 0 ? "text-vw-success" : "text-vw-error")
                      )}
                    >
                      {isMarj ? `%${vwVal.toFixed(1)}` : `${formatNum(vwVal)} TL`}
                    </td>
                    <td
                      className={cn(
                        "p-2 text-right text-sm tabular-nums",
                        isKar && (hmVal >= 0 ? "text-vw-success" : "text-vw-error")
                      )}
                    >
                      {isMarj ? `%${hmVal.toFixed(1)}` : `${formatNum(hmVal)} TL`}
                    </td>
                    <td
                      className={cn(
                        "p-2 text-right text-sm tabular-nums",
                        diff >= 0 ? "text-vw-success" : "text-vw-error"
                      )}
                    >
                      {isMarj
                        ? `${diff >= 0 ? "+" : ""}${diff.toFixed(1)} pp`
                        : `${diff >= 0 ? "+" : ""}${formatNum(diff)} TL`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

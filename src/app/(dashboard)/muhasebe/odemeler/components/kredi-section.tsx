"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface KrediOdeme {
  tutar: number;
  cinsi: string | null;
  odeme_durum: string | null;
  kredi_grubu: string | null;
}

interface KrediSectionProps {
  odemeler: KrediOdeme[];
}

export function KrediSection({ odemeler }: KrediSectionProps) {
  const krediData = useMemo(() => {
    // Sadece KREDİ türündeki ödemeler (parent'tan filtrelenmiş gelmeli ama yine de kontrol)
    const grupMap = new Map<string, { bekleyenTl: number; bekleyenUsd: number; adet: number }>();
    let toplamBekleyen = 0;

    for (const o of odemeler) {
      const grup = o.kredi_grubu || "Diğer";
      const existing = grupMap.get(grup) || { bekleyenTl: 0, bekleyenUsd: 0, adet: 0 };

      if (o.odeme_durum === "BEKLİYOR") {
        if (o.cinsi === "USD") {
          existing.bekleyenUsd += Number(o.tutar);
        } else {
          existing.bekleyenTl += Number(o.tutar);
        }
        toplamBekleyen += o.cinsi === "TL" ? Number(o.tutar) : 0;
      }
      existing.adet += 1;
      grupMap.set(grup, existing);
    }

    const gruplar = Array.from(grupMap.entries())
      .map(([grup, data]) => ({ grup, ...data }))
      .sort((a, b) => b.bekleyenTl - a.bekleyenTl);

    return { gruplar, toplamBekleyen, toplamAdet: odemeler.length };
  }, [odemeler]);

  if (krediData.toplamAdet === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          Kredi Borçları
          <Badge variant="outline" className="ml-auto text-xs">
            {krediData.toplamAdet} kayıt
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {krediData.gruplar.map(({ grup, bekleyenTl, bekleyenUsd, adet }) => (
            <div
              key={grup}
              className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{grup}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {adet}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                {bekleyenTl > 0 && (
                  <span className="text-sm font-semibold tabular-nums text-amber-700">
                    {formatCurrency(bekleyenTl, "TL")}
                  </span>
                )}
                {bekleyenUsd > 0 && (
                  <span className="text-sm font-semibold tabular-nums text-blue-700">
                    {formatCurrency(bekleyenUsd, "USD")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between rounded-md bg-red-50 px-3 py-2">
          <span className="text-sm font-medium text-red-800">Toplam Bekleyen (TL)</span>
          <span className="text-sm font-bold tabular-nums text-red-800">
            {formatCurrency(krediData.toplamBekleyen, "TL")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

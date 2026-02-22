"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SevkiyatStatusBadge } from "../components/sevkiyat-status-badge";
import type { ShipmentSettings } from "@/lib/shipment-settings-types";
import { MaliyetEditSheet } from "./maliyet-edit-sheet";
import type { SevkiyatRow, SevkiyatMaliyetRow, DovizKuruRow } from "../actions";
import type { LojistikToplam } from "./page";
import { Pencil } from "lucide-react";

interface MaliyetlerClientProps {
  sevkiyatlar: Pick<SevkiyatRow, "sevkiyat_id" | "sevkiyat_adi" | "country_code" | "durum" | "created_at">[];
  maliyetMap: Record<string, SevkiyatMaliyetRow>;
  lojistikMap: Record<string, LojistikToplam>;
  sonKur: DovizKuruRow | null;
  settings: ShipmentSettings;
}

function toUsd(amount: number, currency: string, kur: DovizKuruRow | null): number {
  if (amount === 0 || !kur) return amount;
  switch (currency) {
    case "USD": return amount;
    case "EUR": return amount * (kur.eur_usd ?? 1);
    case "GBP": return amount * (kur.gbp_usd ?? 1);
    case "TRY": return kur.usd_try ? amount / kur.usd_try : amount;
    default: return amount;
  }
}

function getMaliyetToplamUsd(m: SevkiyatMaliyetRow, kur: DovizKuruRow | null): number {
  return (
    toUsd(m.navlun, m.navlun_currency, kur) +
    toUsd(m.ic_nakliye, m.ic_nakliye_currency, kur) +
    toUsd(m.ara_depo, m.ara_depo_currency, kur) +
    toUsd(m.amazon_pickup, m.amazon_pickup_currency, kur) +
    toUsd(m.ydg, m.ydg_currency, kur) +
    toUsd(m.tr_gumruk, m.tr_gumruk_currency, kur) +
    toUsd(m.diger, m.diger_currency, kur)
  );
}

export function MaliyetlerClient({ sevkiyatlar, maliyetMap, lojistikMap, sonKur, settings }: MaliyetlerClientProps) {
  const countryMap = Object.fromEntries(settings.ulkeler.map((c) => [c.code, c]));
  const router = useRouter();
  const [editTarget, setEditTarget] = useState<{
    sevkiyatId: string;
    sevkiyatAdi: string;
    totalDesi: number;
  } | null>(null);

  if (sevkiyatlar.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <p>Henüz sevkiyat kaydı bulunmuyor.</p>
      </Card>
    );
  }

  const handleSaved = () => {
    router.refresh();
  };

  return (
    <div className="space-y-3">
      {sonKur && (
        <p className="text-xs text-muted-foreground">
          Kur: 1 USD = {sonKur.usd_try?.toFixed(2)} TRY | 1 EUR = {sonKur.eur_usd?.toFixed(4)} USD | Tarih: {sonKur.tarih}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Sevkiyat</th>
              <th className="pb-2 pr-3 font-medium">Ülke</th>
              <th className="pb-2 pr-3 font-medium">Durum</th>
              <th className="pb-2 pr-2 font-medium text-right">Desi</th>
              <th className="pb-2 pr-2 font-medium text-right hidden md:table-cell">Ağırlık</th>
              <th className="pb-2 pr-2 font-medium text-right hidden md:table-cell">Hacim</th>
              <th className="pb-2 pr-2 font-medium text-right">Toplam $</th>
              <th className="pb-2 pr-2 font-medium text-right">$/desi</th>
              <th className="pb-2 font-medium text-center">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {sevkiyatlar.map((s) => {
              const m = maliyetMap[s.sevkiyat_id];
              const loj = lojistikMap[s.sevkiyat_id] ?? { desi: 0, agirlik: 0, hacim: 0 };
              const toplamUsd = m ? getMaliyetToplamUsd(m, sonKur) : 0;
              const desiUsd = loj.desi > 0 && toplamUsd > 0 ? toplamUsd / loj.desi : 0;
              const countryCode = s.country_code ?? "";

              return (
                <tr
                  key={s.sevkiyat_id}
                  className="border-b hover:bg-muted/50 transition-colors"
                >
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="font-mono text-[10px] px-1.5 h-5">
                        {s.sevkiyat_id}
                      </Badge>
                      <span className="truncate max-w-[120px] text-xs hidden sm:inline">
                        {s.sevkiyat_adi}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {countryMap[countryCode]?.code ?? s.country_code}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3">
                    <SevkiyatStatusBadge durum={s.durum} />
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-xs">
                    {loj.desi > 0 ? loj.desi.toFixed(1) : "—"}
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-xs hidden md:table-cell">
                    {loj.agirlik > 0 ? `${loj.agirlik.toFixed(1)} kg` : "—"}
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-xs hidden md:table-cell">
                    {loj.hacim > 0 ? `${loj.hacim.toFixed(3)} m³` : "—"}
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-xs font-semibold">
                    {toplamUsd > 0 ? `$${toplamUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-xs">
                    {desiUsd > 0 ? (
                      <Badge variant="outline" className="text-[10px] font-mono">
                        ${desiUsd.toFixed(2)}
                      </Badge>
                    ) : "—"}
                  </td>
                  <td className="py-2 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setEditTarget({
                        sevkiyatId: s.sevkiyat_id,
                        sevkiyatAdi: s.sevkiyat_adi ?? "",
                        totalDesi: loj.desi,
                      })}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" />
                      Düzenle
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editTarget && (
        <MaliyetEditSheet
          open={!!editTarget}
          onOpenChange={(open) => { if (!open) setEditTarget(null); }}
          sevkiyatId={editTarget.sevkiyatId}
          sevkiyatAdi={editTarget.sevkiyatAdi}
          totalDesi={editTarget.totalDesi}
          sonKur={sonKur}
          maliyetAyarlari={settings.maliyetAyarlari}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

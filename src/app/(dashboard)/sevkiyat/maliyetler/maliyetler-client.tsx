"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SevkiyatStatusBadge } from "../components/sevkiyat-status-badge";
import { SEVKIYAT_COUNTRIES, type SevkiyatCountryCode } from "@/lib/constants";
import type { SevkiyatRow, SevkiyatMaliyetRow, DovizKuruRow } from "../actions";

interface MaliyetlerClientProps {
  sevkiyatlar: Pick<SevkiyatRow, "sevkiyat_id" | "sevkiyat_adi" | "country_code" | "durum" | "created_at">[];
  maliyetMap: Record<string, SevkiyatMaliyetRow>;
  sonKur: DovizKuruRow | null;
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

export function MaliyetlerClient({ sevkiyatlar, maliyetMap, sonKur }: MaliyetlerClientProps) {
  const router = useRouter();

  if (sevkiyatlar.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <p>Henüz sevkiyat kaydı bulunmuyor.</p>
      </Card>
    );
  }

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
              <th className="pb-2 pr-2 font-medium text-right">Navlun</th>
              <th className="pb-2 pr-2 font-medium text-right hidden md:table-cell">İç Nak.</th>
              <th className="pb-2 pr-2 font-medium text-right hidden md:table-cell">Ara Depo</th>
              <th className="pb-2 pr-2 font-medium text-right hidden lg:table-cell">Amazon</th>
              <th className="pb-2 pr-2 font-medium text-right hidden lg:table-cell">YDG</th>
              <th className="pb-2 pr-2 font-medium text-right hidden lg:table-cell">Gümrük</th>
              <th className="pb-2 pr-2 font-medium text-right hidden lg:table-cell">Diğer</th>
              <th className="pb-2 font-medium text-right">Toplam $</th>
            </tr>
          </thead>
          <tbody>
            {sevkiyatlar.map((s) => {
              const m = maliyetMap[s.sevkiyat_id];
              const toplamUsd = m ? getMaliyetToplamUsd(m, sonKur) : 0;
              const countryCode = s.country_code as SevkiyatCountryCode;

              return (
                <tr
                  key={s.sevkiyat_id}
                  className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/sevkiyat/${s.sevkiyat_id}`)}
                >
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="font-mono text-[10px] px-1.5 h-5">
                        {s.sevkiyat_id}
                      </Badge>
                      <span className="truncate max-w-[120px] text-xs">
                        {s.sevkiyat_adi}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {SEVKIYAT_COUNTRIES[countryCode]?.code ?? s.country_code}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3">
                    <SevkiyatStatusBadge durum={s.durum} />
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-xs">
                    {m ? `${m.navlun.toLocaleString()} ${m.navlun_currency}` : "—"}
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-xs hidden md:table-cell">
                    {m ? `${m.ic_nakliye.toLocaleString()} ${m.ic_nakliye_currency}` : "—"}
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-xs hidden md:table-cell">
                    {m ? `${m.ara_depo.toLocaleString()} ${m.ara_depo_currency}` : "—"}
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-xs hidden lg:table-cell">
                    {m ? `${m.amazon_pickup.toLocaleString()} ${m.amazon_pickup_currency}` : "—"}
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-xs hidden lg:table-cell">
                    {m ? `${m.ydg.toLocaleString()} ${m.ydg_currency}` : "—"}
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-xs hidden lg:table-cell">
                    {m ? `${m.tr_gumruk.toLocaleString()} ${m.tr_gumruk_currency}` : "—"}
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-xs hidden lg:table-cell">
                    {m ? `${m.diger.toLocaleString()} ${m.diger_currency}` : "—"}
                  </td>
                  <td className="py-2 text-right font-mono text-xs font-semibold">
                    {toplamUsd > 0 ? `$${toplamUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

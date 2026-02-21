import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SEVKIYAT_COST_ROLES } from "@/lib/constants";
import { MaliyetlerClient } from "./maliyetler-client";
import type { SevkiyatRow, SevkiyatMaliyetRow, DovizKuruRow } from "../actions";

export const metadata: Metadata = { title: "Sevkiyat Maliyetleri" };

export type LojistikToplam = { desi: number; agirlik: number; hacim: number };

export default async function MaliyetlerPage() {
  const user = await getCurrentUser();
  if (!user || !SEVKIYAT_COST_ROLES.includes(user.role)) {
    redirect("/");
  }

  const supabase = await createClient();

  // Son 12 aylık sevkiyatlar
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const { data: sevkData } = await supabase
    .from("sevkiyat")
    .select("sevkiyat_id, sevkiyat_adi, country_code, durum, created_at")
    .gte("created_at", oneYearAgo.toISOString())
    .order("created_at", { ascending: false });

  const sevkiyatlar = (sevkData ?? []) as Pick<SevkiyatRow, "sevkiyat_id" | "sevkiyat_adi" | "country_code" | "durum" | "created_at">[];

  // Tüm maliyetler + lojistik toplamları
  const sevkIds = sevkiyatlar.map((s) => s.sevkiyat_id);
  let maliyetMap: Record<string, SevkiyatMaliyetRow> = {};
  const lojistikMap: Record<string, LojistikToplam> = {};

  if (sevkIds.length > 0) {
    const [{ data: malData }, { data: itemsData }] = await Promise.all([
      supabase
        .from("sevkiyat_maliyetler")
        .select("*")
        .in("sevkiyat_id", sevkIds),
      supabase
        .from("sevkiyat_items")
        .select("sevkiyat_id, desi, agirlik, hacim")
        .in("sevkiyat_id", sevkIds),
    ]);

    if (malData) {
      for (const m of malData as SevkiyatMaliyetRow[]) {
        maliyetMap[m.sevkiyat_id] = m;
      }
    }

    for (const item of (itemsData ?? []) as { sevkiyat_id: string; desi: number | null; agirlik: number | null; hacim: number | null }[]) {
      const e = lojistikMap[item.sevkiyat_id] ?? { desi: 0, agirlik: 0, hacim: 0 };
      e.desi += item.desi ?? 0;
      e.agirlik += item.agirlik ?? 0;
      e.hacim += item.hacim ?? 0;
      lojistikMap[item.sevkiyat_id] = e;
    }
  }

  // Son döviz kuru
  const { data: kurData } = await supabase
    .from("doviz_kurlari")
    .select("*")
    .order("tarih", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="px-4 pb-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Sevkiyat Maliyetleri</h1>
        <p className="text-sm text-muted-foreground">
          Tüm sevkiyatların maliyet özetleri — satır düzenle ile maliyet girişi yapabilirsiniz
        </p>
      </div>
      <MaliyetlerClient
        sevkiyatlar={sevkiyatlar}
        maliyetMap={maliyetMap}
        lojistikMap={lojistikMap}
        sonKur={kurData as DovizKuruRow | null}
      />
    </div>
  );
}

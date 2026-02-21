import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SEVKIYAT_COST_ROLES } from "@/lib/constants";
import { MaliyetlerClient } from "./maliyetler-client";
import type { SevkiyatRow, SevkiyatMaliyetRow, DovizKuruRow } from "../actions";

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

  // Tüm maliyetler
  const sevkIds = sevkiyatlar.map((s) => s.sevkiyat_id);
  let maliyetMap: Record<string, SevkiyatMaliyetRow> = {};
  if (sevkIds.length > 0) {
    const { data: malData } = await supabase
      .from("sevkiyat_maliyetler")
      .select("*")
      .in("sevkiyat_id", sevkIds);

    if (malData) {
      for (const m of malData as SevkiyatMaliyetRow[]) {
        maliyetMap[m.sevkiyat_id] = m;
      }
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
          Tüm sevkiyatların maliyet özetleri
        </p>
      </div>
      <MaliyetlerClient
        sevkiyatlar={sevkiyatlar}
        maliyetMap={maliyetMap}
        sonKur={kurData as DovizKuruRow | null}
      />
    </div>
  );
}

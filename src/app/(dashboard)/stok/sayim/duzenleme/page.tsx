import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { STOCK_ACCESS_ROLES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { DuzenlemeClient, type DuzenlemeUrun } from "./components/duzenleme-client";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Stok Düzenleme" };

export default async function StokDuzenlemePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!STOCK_ACCESS_ROLES.includes(user.role)) redirect("/");

  const supabase = await createClient();
  // urun_stok_duzeltme_ozet görünümü yeni migration ile gelir; üretilmiş tiplerde yok
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [depoRes, urunRes, depoStokRes, toplamRes, ozetRes] = await Promise.all([
    supabase.from("depolar").select("depo_id, ad").eq("aktif", true).order("sira"),
    supabase.from("products").select("sku, urun_adi, kategori").eq("aktif_mi", true).order("sku"),
    supabase.from("urun_depo_stok").select("sku, depo_id, miktar"),
    supabase.from("urun_toplam_stok").select("sku, miktar"),
    sb.from("urun_stok_duzeltme_ozet").select("sku, toplam_artis, toplam_azalis, son_duzeltme"),
  ]);

  const depoStok = new Map<string, number>();
  for (const r of depoStokRes.data ?? []) {
    if (r.sku && r.depo_id) depoStok.set(`${r.sku}|${r.depo_id}`, Number(r.miktar ?? 0));
  }
  const toplam = new Map<string, number>(
    (toplamRes.data ?? []).filter((r) => r.sku).map((r) => [r.sku as string, Number(r.miktar ?? 0)]),
  );
  const ozet = new Map<string, { artis: number; azalis: number; son: string | null }>(
    ((ozetRes.data ?? []) as { sku: string; toplam_artis: number; toplam_azalis: number; son_duzeltme: string | null }[])
      .map((r) => [r.sku, { artis: Number(r.toplam_artis), azalis: Number(r.toplam_azalis), son: r.son_duzeltme }]),
  );

  const depolar = (depoRes.data ?? []) as { depo_id: string; ad: string }[];
  const urunler: DuzenlemeUrun[] = (urunRes.data ?? []).map((p) => ({
    sku: p.sku,
    ad: p.urun_adi,
    kategori: (p.kategori as string | null) ?? null,
    toplam: toplam.get(p.sku) ?? 0,
    depoMiktar: Object.fromEntries(depolar.map((d) => [d.depo_id, depoStok.get(`${p.sku}|${d.depo_id}`) ?? 0])),
    artis: ozet.get(p.sku)?.artis ?? 0,
    azalis: ozet.get(p.sku)?.azalis ?? 0,
    sonDuzeltme: ozet.get(p.sku)?.son ?? null,
  }));

  return (
    <div className="space-y-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/stok/sayim">
            <ChevronLeft className="mr-1 size-4" />
            Stok Sayımı
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-xl font-semibold">Stok Düzenleme</h1>
        <p className="text-sm text-muted-foreground">
          Mamül stoğunu depo bazında artı/eksi miktarla düzeltin. Her düzeltme gerekçesiyle birlikte
          &quot;Stok Düzeltme&quot; hareketi olarak kaydedilir.
        </p>
      </div>
      <DuzenlemeClient depolar={depolar} urunler={urunler} />
    </div>
  );
}

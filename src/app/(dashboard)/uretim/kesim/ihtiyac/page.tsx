import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTION_ACCESS_ROLES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IhtiyacClient, type IhtiyacSatiri, type SevkiyatSecenegi } from "./components/ihtiyac-client";
import { ChevronLeft } from "lucide-react";

export const metadata: Metadata = { title: "Kesim İhtiyacı" };
export const dynamic = "force-dynamic";

/** Sevk edilmemiş, yani hâlâ üretim gerektiren sevkiyat durumları */
const ACIK_DURUMLAR = ["bekliyor", "hazirlaniyor"];

export default async function KesimIhtiyacPage({
  searchParams,
}: {
  searchParams: Promise<{ sevkiyat?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!PRODUCTION_ACCESS_ROLES.includes(user.role)) redirect("/");

  const { sevkiyat: seciliSevkiyat } = await searchParams;
  const supabase = await createClient();

  // 1) Açık sevkiyatlar
  const { data: sevkiyatlar } = await supabase
    .from("sevkiyat")
    .select("sevkiyat_id, durum, sevkiyat_adi, ulke")
    .in("durum", ACIK_DURUMLAR)
    .order("created_at", { ascending: false });

  const acikIdler = (sevkiyatlar ?? []).map((s) => s.sevkiyat_id);
  const kapsam = seciliSevkiyat && acikIdler.includes(seciliSevkiyat)
    ? [seciliSevkiyat]
    : acikIdler;

  let satirlar: IhtiyacSatiri[] = [];
  let urunOzeti = { cesit: 0, adet: 0, eksik: 0 };

  if (kapsam.length > 0) {
    // 2) Sevkiyat kalemleri
    const { data: kalemler } = await supabase
      .from("sevkiyat_items")
      .select("sku, qty")
      .in("sevkiyat_id", kapsam);

    const talep = new Map<string, number>();
    for (const k of kalemler ?? []) {
      if (k.sku) talep.set(k.sku, (talep.get(k.sku) ?? 0) + (k.qty ?? 0));
    }

    // 3) Mevcut mamül stoğu düşülür — sadece eksik kalan üretilecek
    const { data: mamulStok } = await supabase
      .from("urun_toplam_stok")
      .select("sku, miktar")
      .in("sku", [...talep.keys()]);
    const stokHaritasi = new Map(
      (mamulStok ?? [])
        .filter((s): s is { sku: string; miktar: number | null } => !!s.sku)
        .map((s) => [s.sku, Number(s.miktar ?? 0)]),
    );

    const eksikUrun = new Map<string, number>();
    for (const [sku, adet] of talep) {
      const eksik = adet - (stokHaritasi.get(sku) ?? 0);
      if (eksik > 0) eksikUrun.set(sku, eksik);
    }

    urunOzeti = {
      cesit: talep.size,
      adet: [...talep.values()].reduce((t, v) => t + v, 0),
      eksik: [...eksikUrun.values()].reduce((t, v) => t + v, 0),
    };

    if (eksikUrun.size > 0) {
      // 4) Reçete: ürünün adımları → adımların malzemeleri
      const skular = [...eksikUrun.keys()];
      const { data: adimlar } = await supabase
        .from("assembly_steps")
        .select("step_id, sku")
        .in("sku", skular);

      const stepSku = new Map((adimlar ?? []).map((a) => [a.step_id, a.sku]));
      const stepIds = [...stepSku.keys()];

      const bomSatirlari: { part_id: string; qty_per: number; step_id: string }[] = [];
      // step_bom büyük olabilir; parça parça çekiliyor
      for (let i = 0; i < stepIds.length; i += 200) {
        const { data } = await supabase
          .from("step_bom")
          .select("part_id, qty_per, step_id")
          .in("step_id", stepIds.slice(i, i + 200));
        bomSatirlari.push(...((data ?? []) as typeof bomSatirlari));
      }

      /**
       * ASM- ile başlayan satırlar önceki montaj adımının çıktısı,
       * gerçek malzeme değil — atlanıyor, yoksa aynı parça iki kez sayılır.
       */
      const gereken = new Map<string, { miktar: number; urunler: Set<string> }>();
      for (const b of bomSatirlari) {
        if (b.part_id.startsWith("ASM-")) continue;
        const sku = stepSku.get(b.step_id);
        if (!sku) continue;
        const urunAdet = eksikUrun.get(sku) ?? 0;
        if (urunAdet <= 0) continue;

        const g = gereken.get(b.part_id) ?? { miktar: 0, urunler: new Set<string>() };
        g.miktar += (b.qty_per ?? 0) * urunAdet;
        g.urunler.add(sku);
        gereken.set(b.part_id, g);
      }

      // 5) Eldeki parça stoğu düşülür
      const partIds = [...gereken.keys()];
      const parcalar: { part_id: string; part_adi: string | null; part_type: string | null;
                        yari_mamul_stok: number | null; hazir_eleman_aktif_stok: number | null }[] = [];
      for (let i = 0; i < partIds.length; i += 200) {
        const { data } = await supabase
          .from("all_parts")
          .select("part_id, part_adi, part_type, yari_mamul_stok, hazir_eleman_aktif_stok")
          .in("part_id", partIds.slice(i, i + 200));
        parcalar.push(...((data ?? []) as typeof parcalar));
      }
      const parcaHaritasi = new Map(parcalar.map((p) => [p.part_id, p]));

      satirlar = partIds.map((pid) => {
        const g = gereken.get(pid)!;
        const p = parcaHaritasi.get(pid);
        const tur = p?.part_type ?? "BİLİNMİYOR";
        const eldeki = tur === "YARIMAMUL"
          ? Number(p?.yari_mamul_stok ?? 0)
          : Number(p?.hazir_eleman_aktif_stok ?? 0);
        return {
          part_id: pid,
          part_adi: p?.part_adi ?? null,
          tur,
          gereken: Math.round(g.miktar),
          eldeki,
          net: Math.round(g.miktar) - eldeki,
          urun_sayisi: g.urunler.size,
        };
      }).sort((a, b) => b.net - a.net);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/uretim/kesim">
            <ChevronLeft className="mr-1 size-4" />
            Kesim
          </Link>
        </Button>
        <h1 className="mt-1 text-xl font-semibold">Sevkiyattan Kesim İhtiyacı</h1>
        <p className="text-sm text-muted-foreground">
          Bekleyen sevkiyatlar için reçeteye göre gereken malzeme
        </p>
      </div>

      {kapsam.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-medium">Açık sevkiyat yok</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Yalnızca <b>bekliyor</b> ve <b>hazırlanıyor</b> durumundaki sevkiyatlar
            hesaba katılır; yola çıkmış olanlar için üretim gerekmez.
          </p>
        </Card>
      ) : (
        <IhtiyacClient
          sevkiyatlar={(sevkiyatlar ?? []) as SevkiyatSecenegi[]}
          seciliSevkiyat={seciliSevkiyat ?? ""}
          satirlar={satirlar}
          urunOzeti={urunOzeti}
        />
      )}
    </div>
  );
}

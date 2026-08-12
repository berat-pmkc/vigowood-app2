import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTION_ACCESS_ROLES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SablonTasarimci } from "./components/sablon-tasarimci";
import type { SablonKaydi } from "./actions";
import { ChevronLeft } from "lucide-react";

export const metadata: Metadata = { title: "Kutu Şablonları" };
export const dynamic = "force-dynamic";

export default async function KutuSablonlariPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!PRODUCTION_ACCESS_ROLES.includes(user.role)) redirect("/");

  const supabase = await createClient();

  const [sablonRes, parcaRes, urunRes, tuketimRes] = await Promise.all([
    supabase
      .from("kutu_sablonlari")
      .select("sablon_id, ad, fefco_kodu, ic_uzunluk, ic_genislik, ic_yukseklik, hesaplanan_en, hesaplanan_boy, alan_m2, part_id, sku, oluk_tipi, notlar")
      .eq("aktif", true)
      .order("updated_at", { ascending: false }),
    supabase
      .from("all_parts")
      .select("part_id, part_adi")
      .in("part_type", ["KUTU", "KARTON"])
      .order("part_adi"),
    supabase.from("products").select("sku").eq("aktif_mi", true).order("sku").limit(400),
    supabase
      .from("kutu_aylik_tuketim")
      .select("ay, part_adi, sablon_adi, adet, toplam_m2")
      .order("ay", { ascending: false })
      .limit(12),
  ]);

  const sablonlar = (sablonRes.data ?? []) as SablonKaydi[];
  const kutuParcalari = (parcaRes.data ?? []).map((p) => ({
    id: p.part_id,
    ad: p.part_adi ?? p.part_id,
  }));
  const urunler = (urunRes.data ?? []).map((p) => ({ id: p.sku, ad: p.sku }));
  const tuketim = (tuketimRes.data ?? []) as {
    ay: string; part_adi: string | null; sablon_adi: string | null;
    adet: number | null; toplam_m2: number | null;
  }[];

  return (
    <div className="space-y-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/uretim/kutu">
            <ChevronLeft className="mr-1 size-4" />
            Kutu-Koli
          </Link>
        </Button>
        <h1 className="mt-1 text-xl font-semibold">Kutu Şablonları</h1>
        <p className="text-sm text-muted-foreground">
          İç ölçüyü girin, açık kutu çizimi ve levha ölçüsü otomatik çıksın
        </p>
      </div>

      <SablonTasarimci
        sablonlar={sablonlar}
        kutuParcalari={kutuParcalari}
        urunler={urunler}
      />

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-medium">Aylık kutu / koli tüketimi</h2>
        {tuketim.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Henüz tamamlanmış kutu üretimi yok. Kutu-Koli ekranından üretim
            girildikçe burası dolacak.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs">
                <tr>
                  <th className="px-2.5 py-1.5 text-left font-medium">Ay</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">Ambalaj</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">Şablon</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Adet</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">m²</th>
                </tr>
              </thead>
              <tbody>
                {tuketim.map((t, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2.5 py-1.5">
                      {new Date(t.ay).toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}
                    </td>
                    <td className="px-2.5 py-1.5">{t.part_adi ?? "—"}</td>
                    <td className="px-2.5 py-1.5 text-muted-foreground">
                      {t.sablon_adi ?? "şablon bağlı değil"}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">
                      {Number(t.adet ?? 0).toLocaleString("tr-TR")}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                      {t.toplam_m2 != null ? Number(t.toplam_m2).toLocaleString("tr-TR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">
              m² yalnızca şablonu bağlı ambalajlar için hesaplanır. Boş görünen
              satırlarda ambalaj parçasını bir şablona bağlamanız yeterli.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

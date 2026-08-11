import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { STOCK_ACCESS_ROLES } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { YeniSayimDialog } from "./components/yeni-sayim-dialog";
import { ClipboardList, TriangleAlert } from "lucide-react";

export const dynamic = "force-dynamic";

const DURUM_RENK: Record<string, string> = {
  taslak: "bg-amber-50 text-amber-700 border-amber-300",
  tamamlandi: "bg-emerald-50 text-emerald-700 border-emerald-300",
  iptal: "bg-slate-100 text-slate-600 border-slate-300",
};
const DURUM_ETIKET: Record<string, string> = {
  taslak: "Taslak", tamamlandi: "Tamamlandı", iptal: "İptal",
};

export default async function SayimListePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!STOCK_ACCESS_ROLES.includes(user.role)) redirect("/");

  const supabase = await createClient();

  const [sayimlarRes, bakiyeRes] = await Promise.all([
    supabase
      .from("stok_sayimlari")
      .select("sayim_id, ad, sayim_tarihi, kapsam, durum, notlar, tamamlanma_zamani, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    // Sayım gerekliliğini göstermek için: bakiyesi eksi olan kalem sayısı
    supabase.from("all_parts").select("part_id, part_type, yari_mamul_stok, hazir_eleman_aktif_stok"),
  ]);

  const sayimlar = sayimlarRes.data ?? [];
  const parcalar = bakiyeRes.data ?? [];

  const eksiBakiye = parcalar.filter((p) => {
    const v = p.part_type === "YARIMAMUL" ? p.yari_mamul_stok : p.hazir_eleman_aktif_stok;
    return (v ?? 0) < 0;
  }).length;
  const sifirBakiye = parcalar.filter((p) => {
    const v = p.part_type === "YARIMAMUL" ? p.yari_mamul_stok : p.hazir_eleman_aktif_stok;
    return (v ?? 0) === 0;
  }).length;

  const satirSayilari = new Map<string, number>();
  if (sayimlar.length > 0) {
    const { data } = await supabase
      .from("stok_sayim_satirlari")
      .select("sayim_id")
      .in("sayim_id", sayimlar.map((s) => s.sayim_id));
    for (const r of data ?? []) {
      satirSayilari.set(r.sayim_id, (satirSayilari.get(r.sayim_id) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Stok Sayımı</h1>
          <p className="text-sm text-muted-foreground">
            Fiziksel sayımla bakiyeleri gerçek miktara sabitleyin
          </p>
        </div>
        <YeniSayimDialog />
      </div>

      {(eksiBakiye > 0 || sifirBakiye > 0) && (
        <Card className="border-amber-300 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
            <TriangleAlert className="size-4" />
            Bakiyeler henüz sayımla doğrulanmadı
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-amber-800">
            {eksiBakiye > 0 && <><b>{eksiBakiye}</b> kalemin bakiyesi eksi görünüyor. </>}
            {sifirBakiye > 0 && <><b>{sifirBakiye}</b> kalemin bakiyesi sıfır. </>}
            Sistem bugüne kadar yalnızca hareketleri topladı, hiç açılış stoğu
            girilmedi. Bu yüzden bakiyeler gerçek eldeki miktarı göstermiyor.
            Bir sayım yapıp miktarları sabitlediğinizde sonraki hareketler
            doğru ilerleyecek.
          </p>
        </Card>
      )}

      {sayimlar.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <ClipboardList className="size-8 text-muted-foreground" />
          <p className="font-medium">Henüz sayım yapılmamış</p>
          <p className="max-w-md text-sm text-muted-foreground">
            &quot;Yeni Sayım&quot; ile başlayın. Kapsamı seçtiğinizde sistem o
            andaki miktarları dondurup size sayım listesi çıkarır.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {sayimlar.map((s) => (
            <Link key={s.sayim_id} href={`/stok/sayim/${s.sayim_id}`} className="block">
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s.ad}</span>
                    <Badge variant="outline" className={DURUM_RENK[s.durum]}>
                      {DURUM_ETIKET[s.durum] ?? s.durum}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(s.sayim_tarihi).toLocaleDateString("tr-TR")}
                    {" · "}{s.sayim_id}
                    {" · "}{satirSayilari.get(s.sayim_id) ?? 0} kalem
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(s.kapsam ?? []).map((k: string) => (
                    <Badge key={k} variant="secondary" className="text-[11px]">{k}</Badge>
                  ))}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Card className="p-4">
        <h2 className="text-sm font-medium">Sayım nasıl işler</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Sayım açarsınız; sistem o andaki miktarları dondurur.</li>
          <li>Depoda sayarken ekrandan girersiniz veya Excel şablonunu doldurup yüklersiniz.</li>
          <li>&quot;Sayımı Uygula&quot; dediğinizde fark, kaynağı <b>Sayım</b> olan bir
              hareket olarak deftere yazılır ve bakiye sayılan değere sabitlenir.</li>
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          Geçmiş hareketler silinmez. Saymadığınız kalemlere dokunulmaz —
          boş bırakmak ile sıfır yazmak farklı şeylerdir.
        </p>
      </Card>
    </div>
  );
}

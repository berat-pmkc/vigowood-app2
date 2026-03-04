import { createClient } from "@/lib/supabase/server";
import { KutuBoyutlariClient } from "./components/kutu-boyutlari-client";

export default async function KutuBoyutlariPage() {
  const supabase = (await createClient()) as any;

  const { data: products } = await supabase
    .from("products")
    .select("sku, urun_adi, kutu_en_cm, kutu_boy_cm, kutu_yukseklik_cm, desi")
    .eq("aktif_mi", true)
    .order("sku");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-vw-dark">Kutu Boyutları</h1>
        <p className="text-sm text-muted-foreground">
          Ürün kutu boyutları ve desi bilgileri. Düzenlemek için Admin &gt; Ürünler sayfasını kullanın.
        </p>
      </div>

      <KutuBoyutlariClient data={(products ?? []) as any[]} />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { KutuBoyutlariClient } from "./components/kutu-boyutlari-client";

export default async function KutuBoyutlariPage() {
  // Cast to any — new tables not yet in generated Supabase types
  const supabase = (await createClient()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const { data: boxDimensions } = await supabase
    .from("product_box_dimensions")
    .select("*")
    .order("sku", { ascending: true });

  const { data: products } = await supabase
    .from("products")
    .select("sku, urun_adi")
    .eq("aktif_mi", true)
    .order("sku");

  const productMap: Record<string, string> = {};
  (products as any[] ?? []).forEach((p: any) => {
    productMap[p.sku] = p.urun_adi ?? p.sku;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-vw-dark">Kutu Boyutları</h1>
        <p className="text-sm text-muted-foreground">
          Ürün kutu boyutları ve desi hesaplamaları
        </p>
      </div>

      <KutuBoyutlariClient
        data={(boxDimensions ?? []) as any[]}
        productMap={productMap}
        allSkus={(products as any[] ?? []).map((p: any) => p.sku)}
      />
    </div>
  );
}

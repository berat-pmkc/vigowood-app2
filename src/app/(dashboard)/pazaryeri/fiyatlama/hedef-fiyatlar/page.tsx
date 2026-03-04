import { createClient } from "@/lib/supabase/server";
import { HedefFiyatlarClient } from "./components/hedef-fiyatlar-client";

export default async function HedefFiyatlarPage() {
  // Cast to any — new tables not yet in generated Supabase types
  const supabase = (await createClient()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const { data: targetPrices } = await supabase
    .from("product_target_prices")
    .select("*")
    .order("sku", { ascending: true });

  // Get product names for display
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
        <h1 className="text-2xl font-bold text-vw-dark">Hedef Fiyatlar</h1>
        <p className="text-sm text-muted-foreground">
          SKU bazlı perakende ve toptan hedef fiyatları yönetin
        </p>
      </div>

      <HedefFiyatlarClient
        data={(targetPrices ?? []) as any[]}
        productMap={productMap}
        allSkus={(products as any[] ?? []).map((p: any) => p.sku)}
      />
    </div>
  );
}

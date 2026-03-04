import { createClient } from "@/lib/supabase/server";
import { getMarketplaces } from "../actions";
import { PricingPanelClient } from "./components/pricing-panel-client";

export default async function PricingPanelPage() {
  const supabase = (await createClient()) as any;

  const [marketplaces, { data: products }] = await Promise.all([
    getMarketplaces(),
    supabase
      .from("products")
      .select("sku, urun_adi")
      .eq("aktif_mi", true)
      .order("sku"),
  ]);

  return (
    <PricingPanelClient
      marketplaces={marketplaces}
      allProducts={(products ?? []) as Array<{ sku: string; urun_adi: string | null }>}
    />
  );
}

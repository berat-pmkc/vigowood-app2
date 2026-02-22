import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTION_ACCESS_ROLES } from "@/lib/constants";
import { CompletedSessionsClient } from "./completed-sessions-client";

export const metadata: Metadata = { title: "Tamamlanan Montaj Seansları" };

export default async function TamamlananlarPage() {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  // Ürün listesi (SKU filtresi için)
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("sku, urun_adi")
    .eq("aktif_mi", true)
    .order("urun_adi");

  const productOptions = (products ?? []).map((p) => ({
    sku: p.sku,
    urun_adi: p.urun_adi ?? p.sku,
  }));

  return (
    <div className="pb-20 md:pb-6">
      <CompletedSessionsClient productOptions={productOptions} />
    </div>
  );
}

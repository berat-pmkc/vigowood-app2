import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SEVKIYAT_ACCESS_ROLES } from "@/lib/constants";
import { YeniSevkiyatForm } from "../components/yeni-sevkiyat-form";

export default async function YeniSevkiyatPage() {
  const user = await getCurrentUser();
  if (!user || !SEVKIYAT_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  const supabase = await createClient();

  // Aktif ürünler (ekleme combobox için)
  const { data: products } = await supabase
    .from("products")
    .select("sku, urun_adi, kategori, stok_aktif")
    .eq("aktif_mi", true)
    .order("urun_adi");

  const productList = (products ?? []) as {
    sku: string;
    urun_adi: string | null;
    kategori: string | null;
    stok_aktif: number;
  }[];

  return (
    <div className="pb-20 md:pb-6">
      <YeniSevkiyatForm products={productList} />
    </div>
  );
}

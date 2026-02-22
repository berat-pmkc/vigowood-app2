import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SEVKIYAT_ACCESS_ROLES } from "@/lib/constants";
import { getShipmentSettings } from "@/lib/shipment-settings";
import { ShipmentPlanning } from "./components/shipment-planning";
import type { SevkiyatRow, SevkiyatItemRow } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Sevkiyat Detay" };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SevkiyatDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user || !SEVKIYAT_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  const { id } = await params;
  const settings = await getShipmentSettings();
  const supabase = await createClient();

  // Sevkiyat bilgilerini getir
  const { data: sevkData, error: sevkErr } = await supabase
    .from("sevkiyat")
    .select("*")
    .eq("sevkiyat_id", id)
    .single();

  if (sevkErr || !sevkData) {
    redirect("/sevkiyat");
  }

  const sevkiyat = sevkData as SevkiyatRow;

  // Items getir
  const { data: items } = await supabase
    .from("sevkiyat_items")
    .select("*")
    .eq("sevkiyat_id", id)
    .order("created_at");

  const itemRows = (items ?? []) as SevkiyatItemRow[];

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
    <ShipmentPlanning
      sevkiyat={sevkiyat}
      initialItems={itemRows}
      products={productList}
      konteynerTipleri={settings.konteynerTipleri}
      maliyetAyarlari={settings.maliyetAyarlari}
    />
  );
}

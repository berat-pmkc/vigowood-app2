import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { KampanyalarClient } from "./components/kampanyalar-client";

export const metadata: Metadata = { title: "Kampanyalar" };

export default async function KampanyalarPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kampanyalar")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">Veri yüklenirken hata oluştu: {error.message}</p>
      </div>
    );
  }

  const kampanyalar = (data || []) as {
    id: string;
    kodu: string;
    kampanya_adi: string;
    baslangic_tarihi: string;
    bitis_tarihi: string;
    ana_hedef: string | null;
    ziyaretci: number | null;
    siparis_sayisi: number | null;
    ciro: number | null;
    donusum_orani: number | null;
    ortalama_sepet: number | null;
    notlar: string | null;
    aktif_mi: boolean;
  }[];

  return (
    <div className="px-4 sm:px-6">
      <KampanyalarClient kampanyalar={kampanyalar} />
    </div>
  );
}

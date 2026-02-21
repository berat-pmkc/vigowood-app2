import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { RaporlarClient } from "./components/raporlar-client";

export const metadata: Metadata = { title: "Satis Raporlari" };

export default async function RaporlarPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("satis_raporlari")
    .select("*")
    .eq("durum", "aktif")
    .order("yukleme_tarihi", { ascending: false });

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">
          Veri yüklenirken hata oluştu: {error.message}
        </p>
      </div>
    );
  }

  const raporlar = (data || []) as {
    id: string;
    rapor_id: string;
    rapor_tarihi: string;
    yukleme_tarihi: string;
    yukleyen_adi: string | null;
    dosya_adi: string | null;
    toplam_satir: number;
    toplam_adet: number;
    toplam_tutar: number;
    tr_tutar: number;
    ihracat_tutar: number;
    durum: string;
  }[];

  return (
    <div className="px-4 sm:px-6">
      <RaporlarClient raporlar={raporlar} />
    </div>
  );
}

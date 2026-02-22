import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSalesSettings } from "@/lib/sales-settings";
import { PazarlamaClient } from "./components/pazarlama-client";

export const metadata: Metadata = { title: "Pazarlama" };

export default async function PazarlamaPage() {
  const [supabase, settings] = await Promise.all([
    createClient(),
    getSalesSettings(),
  ]);

  const { data, error } = await supabase
    .from("tr_pazarlama")
    .select("*")
    .order("yil", { ascending: false })
    .order("ay", { ascending: false });

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">Veri yüklenirken hata oluştu: {error.message}</p>
      </div>
    );
  }

  const rows = (data || []) as {
    id: string;
    kodu: string;
    yil: number;
    ay: number;
    pazaryeri: string;
    hedef_ciro: number;
    gercek_ciro: number;
    siparis_sayisi: number;
    ziyaretci: number;
    donusum_orani: number;
    iadeler: number;
    ortalama_sepet: number | null;
    reklam_harcamasi: number | null;
    not_text: string | null;
  }[];

  return (
    <div className="px-4 sm:px-6">
      <PazarlamaClient
        rows={rows}
        pazaryeriSecenekleri={settings.pazaryeriSecenekleri}
        basariEsikleri={settings.basariEsikleri}
      />
    </div>
  );
}

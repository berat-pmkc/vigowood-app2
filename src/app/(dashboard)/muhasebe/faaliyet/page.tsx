import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { FaaliyetClient } from "./components/faaliyet-client";
import {
  getDonemsWithStatus,
  getSatisGirisForDonem,
  getMaliyetGirisForDonem,
  getDonemSummary,
  getDistinctPazaryerleri,
} from "./actions";

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    donem?: string;
  }>;
}

export const metadata: Metadata = {
  title: "Faaliyet Hesapları | VigoWood",
};

export default async function FaaliyetPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const activeTab = (["ozet", "satis", "maliyet"].includes(params.tab ?? ""))
    ? params.tab!
    : "ozet";

  // 1. Tüm dönemleri getir
  const donemlerWithStatus = await getDonemsWithStatus();

  // 2. Seçili dönem
  const selectedDonemId = params.donem || donemlerWithStatus[0]?.id || "";

  // 3. Seçili dönemin detayları
  let donemData: {
    id: string;
    yil: number;
    ay_no: number;
    kur_tl_usd: number | null;
    donem_label: string | null;
  } | null = null;

  if (selectedDonemId) {
    const { data } = await supabase
      .from("faaliyet_donemler")
      .select("id, yil, ay_no, kur_tl_usd, donem_label")
      .eq("id", selectedDonemId)
      .single();
    donemData = data;
  }

  // 4. Tab'a göre veri çek
  const [satislar, maliyetler, summary, pazaryerleri] = await Promise.all([
    selectedDonemId ? getSatisGirisForDonem(selectedDonemId) : Promise.resolve([]),
    selectedDonemId ? getMaliyetGirisForDonem(selectedDonemId) : Promise.resolve([]),
    selectedDonemId ? getDonemSummary(selectedDonemId) : Promise.resolve({
      satisCount: 0, maliyetCount: 0,
      hasSatis: false, hasMaliyet: false, hasKarlilik: false,
      toplamGelir: 0, toplamGider: 0, favok: 0, genelKar: 0,
    }),
    getDistinctPazaryerleri(),
  ]);

  return (
    <div className="px-4 sm:px-6">
      <FaaliyetClient
        activeTab={activeTab}
        donemler={donemlerWithStatus.map((d) => ({
          id: d.id,
          yil: d.yil,
          ay_no: d.ay_no,
          donem_label: d.donem_label,
          kur_tl_usd: Number(d.kur_tl_usd) || 0,
          satis_count: d.satis_count,
          maliyet_count: d.maliyet_count,
          karlilik_count: d.karlilik_count,
        }))}
        selectedDonemId={selectedDonemId}
        donemData={donemData ? {
          id: donemData.id,
          yil: donemData.yil,
          ay_no: donemData.ay_no,
          kur: Number(donemData.kur_tl_usd) || 0,
          label: donemData.donem_label ?? "",
        } : null}
        summary={summary}
        satislar={satislar}
        maliyetler={maliyetler}
        pazaryerleri={pazaryerleri}
      />
    </div>
  );
}

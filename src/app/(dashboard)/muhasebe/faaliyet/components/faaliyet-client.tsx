"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FaaliyetDonemSelector } from "./faaliyet-donem-selector";
import { OzetTab } from "./ozet-tab";
import { SatisGirisTab } from "./satis-giris-tab";
import { MaliyetGirisTab } from "./maliyet-giris-tab";
import type { SatisGiris, MaliyetGiris } from "@/lib/supabase/types";

interface DonemOption {
  id: string;
  yil: number;
  ay_no: number;
  donem_label: string | null;
  kur_tl_usd: number;
  satis_count: number;
  maliyet_count: number;
  karlilik_count: number;
}

interface DonemInfo {
  id: string;
  yil: number;
  ay_no: number;
  kur: number;
  label: string;
}

interface SummaryData {
  satisCount: number;
  maliyetCount: number;
  hasSatis: boolean;
  hasMaliyet: boolean;
  hasKarlilik: boolean;
  toplamGelir: number;
  toplamGider: number;
  favok: number;
  genelKar: number;
}

interface FaaliyetClientProps {
  activeTab: string;
  donemler: DonemOption[];
  selectedDonemId: string;
  donemData: DonemInfo | null;
  summary: SummaryData;
  satislar: SatisGiris[];
  maliyetler: MaliyetGiris[];
  pazaryerleri: string[];
}

export function FaaliyetClient({
  activeTab,
  donemler,
  selectedDonemId,
  donemData,
  summary,
  satislar,
  maliyetler,
  pazaryerleri,
}: FaaliyetClientProps) {
  const router = useRouter();

  const handleTabChange = (value: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    router.push(url.pathname + url.search);
  };

  const handleDonemChange = (donemId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("donem", donemId);
    router.push(url.pathname + url.search);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-vw-dark">Faaliyet Hesapları</h1>
          <p className="text-sm text-muted-foreground">
            Aylık satış ve maliyet girişleri, gelir tablosu
          </p>
        </div>
        <FaaliyetDonemSelector
          donemler={donemler}
          selectedDonemId={selectedDonemId}
          onDonemChange={handleDonemChange}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
          <TabsTrigger value="ozet">Ozet</TabsTrigger>
          <TabsTrigger value="satis">Satis Girisi</TabsTrigger>
          <TabsTrigger value="maliyet">Maliyet Girisi</TabsTrigger>
        </TabsList>

        <TabsContent value="ozet" className="mt-6">
          <OzetTab
            summary={summary}
            donemLabel={donemData?.label ?? ""}
            hasDonem={!!donemData}
          />
        </TabsContent>

        <TabsContent value="satis" className="mt-6">
          <SatisGirisTab
            donemData={donemData}
            existingSatislar={satislar}
            pazaryerleri={pazaryerleri}
          />
        </TabsContent>

        <TabsContent value="maliyet" className="mt-6">
          <MaliyetGirisTab
            donemData={donemData}
            existingMaliyetler={maliyetler}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

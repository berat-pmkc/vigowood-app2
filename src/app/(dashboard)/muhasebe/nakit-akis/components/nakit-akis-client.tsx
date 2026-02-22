"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, FileDown } from "lucide-react";
import { NakitKpiCards } from "./nakit-kpi-cards";
import { DonemSelector } from "./donem-selector";
import { GenelBakisTable } from "./genel-bakis-table";
import { GelirYapisiCard } from "./gelir-yapisi-card";
import { SatisKanallariTable } from "./satis-kanallari-table";
import { GiderDagilimiTable } from "./gider-dagilimi-table";
import { BorcYapisiTable } from "./borc-yapisi-table";
import { UyariKartlari } from "./uyari-kartlari";
import { NakitTrendChart } from "./nakit-trend-chart";
import { NakitGirisTakipTab } from "./nakit-giris-takip-tab";

interface DonemOption {
  id: string;
  donem_kodu: string;
}

interface NakitKpiData {
  nakitTl: number;
  nakitUsd: number;
  toplamVarlik: number;
  toplamBorc: number;
  netPozisyon: number;
}

interface GenelBakisData {
  varlikAcilisTl: number;
  varlikAcilisUsd: number;
  nakitGirisTl: number;
  nakitGirisUsd: number;
  nakitCikisTl: number;
  nakitCikisUsd: number;
  varlikTl: number;
  varlikUsd: number;
  yatirimTl: number;
  toplamVarlikTl: number;
  gayrinakitIslem: number;
  toplamPiyasaBorcu: number;
  toplamKkBorc: number;
  toplamFinansalBorc: number;
  kurBilgisi: number;
}

interface GelirYapisiData {
  organikGelir: number;
  dovizSatisi: number;
  nakitKredi: number;
  toplamTl: number;
}

interface SatisKanallariData {
  current: Record<string, number>;
  prev?: Record<string, number>;
}

interface GiderDagilimiData {
  tlValues: Record<string, number>;
  usdValues: Record<string, number>;
  toplamTl: number;
  toplamUsd: number;
}

interface BorcYapisiData {
  piyasaBorcu: number;
  kkBorc: number;
  finansalBorc: number;
}

interface TrendItem {
  donemKodu: string;
  girisTl: number;
  cikisTl: number;
  netTl: number;
}

interface GirisTakipRow {
  id: string;
  tanimi: string;
  tutar: number;
  cinsi: string | null;
  tarih: string | null;
  turu: string | null;
  marka: string | null;
  odeme_durum: string | null;
}

interface NakitAkisClientProps {
  activeTab: string;
  donemler: DonemOption[];
  selectedDonemId: string;
  hasData: boolean;
  kpiData: NakitKpiData;
  genelBakis: GenelBakisData;
  gelirYapisi: GelirYapisiData;
  satisKanallari: SatisKanallariData;
  giderDagilimi: GiderDagilimiData;
  borcYapisi: BorcYapisiData;
  trendData: TrendItem[];
  girisTakipData: GirisTakipRow[];
  prevOrganikGelir?: number;
  kisaVadeliBorc?: number;
}

export function NakitAkisClient({
  activeTab,
  donemler,
  selectedDonemId,
  hasData,
  kpiData,
  genelBakis,
  gelirYapisi,
  satisKanallari,
  giderDagilimi,
  borcYapisi,
  trendData,
  girisTakipData,
  prevOrganikGelir,
  kisaVadeliBorc,
}: NakitAkisClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams();
    if (selectedDonemId) params.set("donem", selectedDonemId);
    if (tab !== "dashboard") params.set("tab", tab);
    startTransition(() => {
      router.push(`/muhasebe/nakit-akis${params.toString() ? `?${params.toString()}` : ""}`);
    });
  };

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nakit Akış Yönetimi</h1>
          <p className="text-sm text-muted-foreground">
            Dönemsel nakit giriş-çıkış takibi ve analizi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DonemSelector donemler={donemler} selectedDonemId={selectedDonemId} />
          {hasData && selectedDonemId && (
            <Button size="sm" variant="outline" asChild>
              <a
                href={`/api/muhasebe/nakit-akis/${selectedDonemId}`}
                download
              >
                <FileDown className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">PDF</span>
              </a>
            </Button>
          )}
          <Button size="sm" asChild>
            <Link href="/muhasebe/nakit-akis/yeni">
              <Plus className="mr-1.5 h-4 w-4" />
              Yeni Dönem
            </Link>
          </Button>
        </div>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <p className="text-muted-foreground">
            {donemler.length === 0
              ? "Henüz dönem oluşturulmamış. Yeni dönem ekleyerek başlayın."
              : "Seçili dönem için veri bulunamadı."}
          </p>
        </div>
      ) : (
        <>
          <UyariKartlari
            data={{
              nakitTl: kpiData.nakitTl,
              toplamBorc: kpiData.toplamBorc,
              toplamVarlik: kpiData.toplamVarlik,
              organikGelir: gelirYapisi.organikGelir,
              prevOrganikGelir,
              kisaVadeliBorc,
            }}
          />

          <NakitKpiCards data={kpiData} />

          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="giris-takip">Giriş Takip</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <GenelBakisTable data={genelBakis} />
                <div className="space-y-4">
                  <GelirYapisiCard data={gelirYapisi} />
                  <BorcYapisiTable data={borcYapisi} />
                </div>
              </div>

              <SatisKanallariTable data={satisKanallari} />
              <GiderDagilimiTable data={giderDagilimi} />
              <NakitTrendChart data={trendData} />
            </TabsContent>

            <TabsContent value="giris-takip" className="mt-4">
              <NakitGirisTakipTab data={girisTakipData} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

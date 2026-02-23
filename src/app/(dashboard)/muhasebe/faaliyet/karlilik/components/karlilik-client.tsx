"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { PieChart as PieChartIcon, TrendingUp, TrendingDown, DollarSign, Percent } from "lucide-react";
import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";
import { GelirTablosu } from "./gelir-tablosu";
import { MarkaKarsilastirma } from "./marka-karsilastirma";

const KarlilikCharts = dynamic(
  () => import("./karlilik-charts").then(mod => ({ default: mod.KarlilikCharts })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

interface AggRow {
  marka: string;
  sira: number;
  kalem_turu: string;
  kalem: string;
  tl: number;
  usd: number;
}

interface DonemOption {
  value: string;
  label: string;
}

interface TrendItem {
  donemKodu: string;
  donemLabel: string;
  gelir: number;
  gider: number;
  favok: number;
  genelKar: number;
}

interface Props {
  periodType: string;
  activeMarka: string;
  selectedLabel: string;
  selectedDonemKodu: string;
  donemOptions: DonemOption[];
  data: AggRow[];
  prevData: AggRow[];
  prevLabel: string;
  trendData: TrendItem[];
  hasData: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function KarlilikClient({
  periodType,
  activeMarka,
  selectedLabel,
  selectedDonemKodu,
  donemOptions,
  data,
  prevData,
  prevLabel,
  trendData,
  hasData,
}: Props) {
  const router = useRouter();

  const navigate = (updates: Record<string, string>) => {
    const url = new URL(window.location.href);
    for (const [key, val] of Object.entries(updates)) {
      url.searchParams.set(key, val);
    }
    router.push(url.pathname + url.search);
  };

  // Extract KPI values for selected marka
  const markaData = data.filter((r) => r.marka === activeMarka);
  const getVal = (kalem: string) =>
    markaData.find((r) => r.kalem === kalem)?.tl ?? 0;

  const toplamGelir = getVal("TOPLAM FAALİYET GELİRİ");
  const toplamGider = getVal("TOPLAM FAALİYET GİDERİ");
  const favok = getVal("FAALİYET KARI (FAVÖK)");
  const favokMarj = markaData.find((r) => r.kalem === "FAVÖK Marjı")?.tl ?? 0;
  const genelKar = getVal("GENEL KAR");

  const kpis = [
    { title: "Toplam Gelir", value: formatCurrency(toplamGelir), icon: DollarSign, color: "text-vw-success", bg: "bg-vw-success/10" },
    { title: "Toplam Gider", value: formatCurrency(toplamGider), icon: TrendingDown, color: "text-vw-error", bg: "bg-vw-error/10" },
    { title: "FAVOK", value: formatCurrency(favok), icon: TrendingUp, color: favok >= 0 ? "text-vw-success" : "text-vw-error", bg: favok >= 0 ? "bg-vw-success/10" : "bg-vw-error/10" },
    { title: "FAVOK Marji", value: `%${favokMarj.toFixed(1)}`, icon: Percent, color: favokMarj >= 0 ? "text-vw-success" : "text-vw-error", bg: favokMarj >= 0 ? "bg-vw-success/10" : "bg-vw-error/10" },
    { title: "Net Kar", value: formatCurrency(genelKar), icon: DollarSign, color: genelKar >= 0 ? "text-vw-success" : "text-vw-error", bg: genelKar >= 0 ? "bg-vw-success/10" : "bg-vw-error/10" },
  ];

  if (!hasData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-vw-dark">Karlilik Analizi</h1>
          <p className="text-sm text-muted-foreground">Gelir tablosu ve karlilik gostergerleri</p>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <PieChartIcon className="h-16 w-16 text-muted-foreground/40" />
          <p className="text-muted-foreground">
            Henuz karlilik verisi yok. Satis ve maliyet girislerini tamamlayin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with selectors */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-vw-dark">Karlilik Analizi</h1>
          <p className="text-sm text-muted-foreground">{selectedLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period type selector */}
          <Select value={periodType} onValueChange={(v) => navigate({ period: v })}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ay">Aylik</SelectItem>
              <SelectItem value="ceyrek">Ceyrek</SelectItem>
              <SelectItem value="yari_yil">Yariyil</SelectItem>
              <SelectItem value="yillik">Yillik</SelectItem>
            </SelectContent>
          </Select>

          {/* Dönem selector */}
          <Select value={selectedDonemKodu} onValueChange={(v) => navigate({ donem: v })}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {donemOptions.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <div className={`rounded-lg p-1.5 ${kpi.bg}`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">{kpi.title}</p>
                  <p className="truncate text-sm font-bold">{kpi.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Marka tabs */}
      <Tabs value={activeMarka} onValueChange={(v) => navigate({ marka: v })}>
        <TabsList>
          <TabsTrigger value="GENEL">GENEL</TabsTrigger>
          <TabsTrigger value="VIGO WOOD">VIGO WOOD</TabsTrigger>
          <TabsTrigger value="HAS-MOB">HAS-MOB</TabsTrigger>
          <TabsTrigger value="KARSILASTIRMA">Karsilastirma</TabsTrigger>
        </TabsList>

        {["GENEL", "VIGO WOOD", "HAS-MOB"].map((marka) => (
          <TabsContent key={marka} value={marka} className="mt-6 space-y-6">
            <GelirTablosu
              data={data.filter((r) => r.marka === marka)}
              prevData={prevData.filter((r) => r.marka === marka)}
              prevLabel={prevLabel}
              label={`${marka} - ${selectedLabel}`}
            />
          </TabsContent>
        ))}

        <TabsContent value="KARSILASTIRMA" className="mt-6 space-y-6">
          <MarkaKarsilastirma
            vwData={data.filter((r) => r.marka === "VIGO WOOD")}
            hmData={data.filter((r) => r.marka === "HAS-MOB")}
            label={selectedLabel}
          />
        </TabsContent>
      </Tabs>

      {/* Charts */}
      <KarlilikCharts
        data={data.filter((r) => r.marka === activeMarka)}
        trendData={trendData}
      />
    </div>
  );
}

"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, FileDown, CalendarDays } from "lucide-react";
import { OdemelerKpiCards } from "./odemeler-kpi-cards";
import { OdemelerDataTable } from "./odemeler-data-table";
import { OdemelerToolbar } from "./odemeler-toolbar";
import { OdemeFormSheet } from "./odeme-form-sheet";
import { OdemelerCalendarView } from "./odemeler-calendar-view";
import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";
import { KrediSection } from "./kredi-section";

const OdemelerSummaryTab = dynamic(
  () => import("./odemeler-summary-tab").then(mod => ({ default: mod.OdemelerSummaryTab })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
import type { Odeme } from "@/lib/supabase/types";

interface SummaryItem {
  tarih: string | null;
  tutar: number;
  odeme_durum: string | null;
  cinsi: string | null;
  turu: string | null;
}

interface OdemeKpiRow {
  id: string;
  tutar: number;
  cinsi: string | null;
  tarih: string | null;
  turu: string | null;
  odeme_durum: string | null;
}

interface OdemelerClientProps {
  activeTab: string;
  summaryData: SummaryItem[];
  listData: Odeme[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  turu: string;
  durum: string;
  cinsi: string;
  dateFrom: string;
  dateTo: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  calendarData: Odeme[];
  calYear: number;
  calMonth: number;
  allOdemeler: OdemeKpiRow[];
}

export function OdemelerClient({
  activeTab,
  summaryData,
  listData,
  totalCount,
  pageIndex,
  pageSize,
  search,
  turu,
  durum,
  cinsi,
  dateFrom,
  dateTo,
  sortBy,
  sortOrder,
  calendarData,
  calYear,
  calMonth,
  allOdemeler,
}: OdemelerClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Odeme | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);

  // Madde 13: Takvimden gelen tarih aralığı
  const [calendarDateRange, setCalendarDateRange] = useState<{ start: Date; end: Date }>(() => {
    const start = new Date(calYear, calMonth, 1);
    const end = new Date(calYear, calMonth + 1, 0);
    return { start, end };
  });

  const handleCalendarRangeChange = useCallback((range: { start: Date; end: Date }) => {
    setCalendarDateRange(range);
  }, []);

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams();
    if (tab !== "takvim") {
      params.set("tab", tab);
    }
    startTransition(() => {
      router.push(`/muhasebe/odemeler${params.toString() ? `?${params.toString()}` : ""}`);
    });
  };

  const handleNewRecord = () => {
    setEditingRecord(null);
    setPrefillDate(null);
    setSheetOpen(true);
  };

  const handleNewRecordWithDate = (dateStr: string) => {
    setEditingRecord(null);
    setPrefillDate(dateStr);
    setSheetOpen(true);
  };

  const handleEdit = (record: Odeme) => {
    setEditingRecord(record);
    setPrefillDate(null);
    setSheetOpen(true);
  };

  const handleSheetClose = () => {
    setSheetOpen(false);
    setEditingRecord(null);
    setPrefillDate(null);
  };

  // Kredi ödemeleri (Madde 9)
  const krediOdemeler = useMemo(
    () =>
      allOdemeler
        .filter((o) => o.turu === "KREDİ")
        .map((o) => ({
          tutar: Number(o.tutar),
          cinsi: o.cinsi,
          odeme_durum: o.odeme_durum,
          kredi_grubu: null as string | null, // Hafif sorgudan gelmiyor, full data'dan bakarız
        })),
    [allOdemeler]
  );

  // calendarData'dan kredi bilgisi (tam veri)
  const allKrediWithGrup = useMemo(() => {
    // allOdemeler kredi_grubu içermiyor, calendarData'da var
    // Tüm veriyi KPI'dan süzmek yerine calendar + list data'dan çıkaralım
    // Aslında odemeler tablosundan tüm kredi kayıtları lazım
    // Ama zaten allOdemeler light sorgu — kredi grubu eklemek için page.tsx değişmeli
    // Şimdilik calendarData'daki ve listData'daki kayıtlardan çıkaralım
    return [...calendarData, ...listData]
      .filter((o) => o.turu === "KREDİ")
      .reduce((acc, o) => {
        // Dedup by id
        if (!acc.find((x) => x.id === o.id)) {
          acc.push(o);
        }
        return acc;
      }, [] as Odeme[])
      .map((o) => ({
        tutar: Number(o.tutar),
        cinsi: o.cinsi,
        odeme_durum: o.odeme_durum,
        kredi_grubu: o.kredi_grubu,
      }));
  }, [calendarData, listData]);

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ödemeler</h1>
          <p className="text-sm text-muted-foreground">
            Ödeme kayıtları, takip ve analiz
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <a
              href={`/api/muhasebe/odemeler/takvim-pdf?year=${calYear}&month=${calMonth}`}
              download
            >
              <CalendarDays className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Takvim PDF</span>
            </a>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a
              href={`/api/muhasebe/odemeler/pdf${turu || durum || cinsi ? `?${new URLSearchParams(Object.entries({ turu, durum, cinsi }).filter(([, v]) => v)).toString()}` : ""}`}
              download
            >
              <FileDown className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">PDF</span>
            </a>
          </Button>
          <Button onClick={handleNewRecord} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Yeni Ödeme
          </Button>
        </div>
      </div>

      {/* Madde 13: KPI'lar takvimden gelen date range'e göre */}
      <OdemelerKpiCards
        allOdemeler={allOdemeler}
        dateRange={calendarDateRange}
      />

      {/* Madde 9: Kredi bölümü */}
      {allKrediWithGrup.length > 0 && (
        <KrediSection odemeler={allKrediWithGrup} />
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="takvim">Takvim</TabsTrigger>
          <TabsTrigger value="liste">Liste</TabsTrigger>
          <TabsTrigger value="ozet">Özet</TabsTrigger>
        </TabsList>

        <TabsContent value="takvim" className="mt-4">
          <OdemelerCalendarView
            calendarData={calendarData}
            calYear={calYear}
            calMonth={calMonth}
            onEdit={handleEdit}
            onNewWithDate={handleNewRecordWithDate}
            onRangeChange={handleCalendarRangeChange}
          />
        </TabsContent>

        <TabsContent value="liste" className="mt-4 space-y-4">
          <OdemelerToolbar
            search={search}
            turu={turu}
            durum={durum}
            cinsi={cinsi}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
          <OdemelerDataTable
            data={listData}
            totalCount={totalCount}
            pageIndex={pageIndex}
            pageSize={pageSize}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onEdit={handleEdit}
          />
        </TabsContent>

        <TabsContent value="ozet" className="mt-4 space-y-4">
          <OdemelerSummaryTab data={summaryData} />
        </TabsContent>
      </Tabs>

      <OdemeFormSheet
        open={sheetOpen}
        onOpenChange={handleSheetClose}
        editingRecord={editingRecord}
        prefillDate={prefillDate}
      />
    </div>
  );
}

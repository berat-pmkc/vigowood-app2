"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Plus, FileDown, CalendarDays, CreditCard } from "lucide-react";
import { OdemelerKpiCards } from "./odemeler-kpi-cards";
import { OdemelerDataTable } from "./odemeler-data-table";
import { OdemelerToolbar } from "./odemeler-toolbar";
import { OdemeFormSheet } from "./odeme-form-sheet";
import { OdemelerCalendarView } from "./odemeler-calendar-view";
import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";
import { formatCurrency } from "@/lib/utils";

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
  krediOdemeler: Odeme[];
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
  krediOdemeler,
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

  // Kredi borçları sheet state
  const [krediSheetOpen, setKrediSheetOpen] = useState(false);

  // Kredi toplam hesaplama
  const bekleyenKrediToplam = useMemo(() => {
    let tl = 0, usd = 0;
    for (const o of krediOdemeler) {
      if (o.odeme_durum === "BEKLİYOR") {
        if (o.cinsi === "USD") usd += Number(o.tutar);
        else tl += Number(o.tutar);
      }
    }
    return { tl, usd };
  }, [krediOdemeler]);

  return (
    <div className="space-y-4 pb-20 md:pb-6 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Ödemeler</h1>
          <p className="text-sm text-muted-foreground">
            Ödeme kayıtları, takip ve analiz
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button size="sm" variant="outline" className="h-8 px-2 sm:px-3" asChild>
            <a
              href={`/api/muhasebe/odemeler/takvim-pdf?year=${calYear}&month=${calMonth}`}
              download
            >
              <CalendarDays className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Takvim PDF</span>
            </a>
          </Button>
          <Button size="sm" variant="outline" className="h-8 px-2 sm:px-3" asChild>
            <a
              href={`/api/muhasebe/odemeler/pdf${turu || durum || cinsi ? `?${new URLSearchParams(Object.entries({ turu, durum, cinsi }).filter(([, v]) => v)).toString()}` : ""}`}
              download
            >
              <FileDown className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">PDF</span>
            </a>
          </Button>
          {krediOdemeler.length > 0 && (
            <Button size="sm" variant="outline" className="h-8 px-2 sm:px-3" onClick={() => setKrediSheetOpen(true)}>
              <CreditCard className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Kredi Borçları</span>
              <Badge variant="secondary" className="ml-1 text-[10px] hidden sm:inline-flex">
                {krediOdemeler.length}
              </Badge>
            </Button>
          )}
          <Button onClick={handleNewRecord} size="sm" className="h-8 px-2 sm:px-3">
            <Plus className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Yeni Ödeme</span>
          </Button>
        </div>
      </div>

      {/* Madde 13: KPI'lar takvimden gelen date range'e göre */}
      <OdemelerKpiCards
        allOdemeler={allOdemeler}
        dateRange={calendarDateRange}
      />

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

      {/* Kredi Borçları Sheet */}
      <Sheet open={krediSheetOpen} onOpenChange={setKrediSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              Kredi Borçları
              <Badge variant="outline" className="ml-auto text-xs">
                {krediOdemeler.length} kayıt
              </Badge>
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 flex gap-3">
            {bekleyenKrediToplam.tl > 0 && (
              <div className="rounded-lg bg-red-50 px-3 py-2 flex-1">
                <p className="text-xs text-red-600">Bekleyen TL</p>
                <p className="text-sm font-bold text-red-800 tabular-nums">
                  {formatCurrency(bekleyenKrediToplam.tl, "TL")}
                </p>
              </div>
            )}
            {bekleyenKrediToplam.usd > 0 && (
              <div className="rounded-lg bg-blue-50 px-3 py-2 flex-1">
                <p className="text-xs text-blue-600">Bekleyen USD</p>
                <p className="text-sm font-bold text-blue-800 tabular-nums">
                  {formatCurrency(bekleyenKrediToplam.usd, "USD")}
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {krediOdemeler.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  setKrediSheetOpen(false);
                  handleEdit(o);
                }}
                className="flex w-full items-center gap-3 rounded-lg border border-border/50 p-3 text-left transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{o.tanimi}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {o.tarih
                        ? new Date(o.tarih + "T00:00:00").toLocaleDateString("tr-TR")
                        : "-"}
                    </span>
                    {o.kredi_grubu && (
                      <Badge variant="secondary" className="text-[10px]">
                        {o.kredi_grubu}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[10px] border-0 ${
                        o.odeme_durum === "TAMAMLANDI"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {o.odeme_durum === "TAMAMLANDI" ? "Tamamlandı" : "Bekliyor"}
                    </Badge>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatCurrency(
                    Number(o.tutar),
                    (o.cinsi as "TL" | "USD" | "EUR") || "TL"
                  )}
                </span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

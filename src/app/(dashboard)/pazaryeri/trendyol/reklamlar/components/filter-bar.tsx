"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Filter, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { deleteAdSnapshot } from "../actions";

export type MetricKey = "spent" | "revenue" | "roas" | "sales" | "ctr" | "cvr";

const METRIC_OPTIONS: { value: MetricKey; label: string }[] = [
  { value: "spent", label: "Harcama" },
  { value: "revenue", label: "Ciro" },
  { value: "roas", label: "ROAS" },
  { value: "sales", label: "Satış" },
  { value: "ctr", label: "CTR" },
  { value: "cvr", label: "CVR" },
];

interface SnapshotDate {
  date: string;
  uploaded_by: string;
  created_at: string;
}

interface Props {
  periods: string[];
  fromPeriod: string;
  toPeriod: string;
  allAdNames: string[];
  selectedAds: string[];
  onSelectedAdsChange: (ads: string[]) => void;
  metric: MetricKey;
  onMetricChange: (m: MetricKey) => void;
  snapshotDates: SnapshotDate[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function FilterBar({
  periods,
  fromPeriod,
  toPeriod,
  allAdNames,
  selectedAds,
  onSelectedAdsChange,
  metric,
  onMetricChange,
  snapshotDates,
}: Props) {
  const router = useRouter();
  const [adPopoverOpen, setAdPopoverOpen] = useState(false);
  const [deletePopoverOpen, setDeletePopoverOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleFromChange = useCallback(
    (val: string) => {
      const params = new URLSearchParams(window.location.search);
      params.set("from", val);
      // Ensure from <= to
      if (val > toPeriod) params.set("to", val);
      router.push(`/pazaryeri/trendyol/reklamlar?${params.toString()}`);
    },
    [router, toPeriod]
  );

  const handleToChange = useCallback(
    (val: string) => {
      const params = new URLSearchParams(window.location.search);
      params.set("to", val);
      // Ensure from <= to
      if (val < fromPeriod) params.set("from", val);
      router.push(`/pazaryeri/trendyol/reklamlar?${params.toString()}`);
    },
    [router, fromPeriod]
  );

  const handleQuick = useCallback(
    (type: "last4" | "all") => {
      const params = new URLSearchParams(window.location.search);
      if (type === "all" && periods.length > 0) {
        params.set("from", periods[periods.length - 1]);
        params.set("to", periods[0]);
      } else if (type === "last4" && periods.length > 0) {
        const start = periods[Math.min(3, periods.length - 1)];
        params.set("from", start);
        params.set("to", periods[0]);
      }
      router.push(`/pazaryeri/trendyol/reklamlar?${params.toString()}`);
    },
    [router, periods]
  );

  const handleMetricChange = useCallback(
    (val: string) => {
      onMetricChange(val as MetricKey);
      const params = new URLSearchParams(window.location.search);
      params.set("metric", val);
      router.push(`/pazaryeri/trendyol/reklamlar?${params.toString()}`, { scroll: false });
    },
    [onMetricChange, router]
  );

  const toggleAd = useCallback(
    (ad: string) => {
      const next = selectedAds.includes(ad)
        ? selectedAds.filter((a) => a !== ad)
        : [...selectedAds, ad];
      onSelectedAdsChange(next);
    },
    [selectedAds, onSelectedAdsChange]
  );

  const handleDelete = useCallback(
    async (date: string) => {
      if (!confirm(`${formatDate(date)} tarihli snapshot silinecek. Emin misiniz?`)) return;
      setDeleting(true);
      const result = await deleteAdSnapshot(date);
      setDeleting(false);
      if (result.success) {
        toast.success("Snapshot silindi");
        setDeletePopoverOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Silme hatası");
      }
    },
    [router]
  );

  // Sorted periods ascending for from/to display
  const sortedPeriods = [...periods].sort((a, b) => a.localeCompare(b));

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      {/* Row 1: Date range + quick buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />

        {periods.length > 0 ? (
          <>
            <Select value={fromPeriod} onValueChange={handleFromChange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Başlangıç" />
              </SelectTrigger>
              <SelectContent>
                {sortedPeriods.map((p) => (
                  <SelectItem key={p} value={p}>
                    {formatDate(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-sm text-muted-foreground">&rarr;</span>

            <Select value={toPeriod} onValueChange={handleToChange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Bitiş" />
              </SelectTrigger>
              <SelectContent>
                {sortedPeriods.map((p) => (
                  <SelectItem key={p} value={p}>
                    {formatDate(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => handleQuick("last4")}>
                Son 4
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleQuick("all")}>
                Tümü
              </Button>
            </div>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Henüz rapor yüklenmedi</span>
        )}
      </div>

      {/* Row 2: Ad filter + metric + snapshot delete */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Ad filter popover */}
        <Popover open={adPopoverOpen} onOpenChange={setAdPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              {selectedAds.length === 0 ? (
                "Tüm Reklamlar"
              ) : (
                <span>{selectedAds.length} reklam seçili</span>
              )}
              <ChevronsUpDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Reklam ara..." />
              <CommandList>
                <CommandEmpty>Reklam bulunamadı</CommandEmpty>
                <CommandGroup>
                  {selectedAds.length > 0 && (
                    <CommandItem onSelect={() => onSelectedAdsChange([])}>
                      <span className="text-muted-foreground">Tümünü Temizle</span>
                    </CommandItem>
                  )}
                  {allAdNames.map((ad) => (
                    <CommandItem key={ad} value={ad} onSelect={() => toggleAd(ad)}>
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedAds.includes(ad) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate text-sm">{ad}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Selected ad badges */}
        {selectedAds.length > 0 && selectedAds.length <= 3 && (
          <div className="flex flex-wrap gap-1">
            {selectedAds.map((ad) => (
              <Badge key={ad} variant="secondary" className="max-w-[120px] truncate text-xs">
                {ad}
              </Badge>
            ))}
          </div>
        )}

        {/* Metric selector */}
        <Select value={metric} onValueChange={handleMetricChange}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METRIC_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Snapshot delete */}
        {snapshotDates.length > 0 && (
          <Popover open={deletePopoverOpen} onOpenChange={setDeletePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto gap-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Snapshot Sil</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-2" align="end">
              <div className="space-y-1">
                <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  Silinecek tarihi seçin
                </p>
                {snapshotDates.map((s) => (
                  <button
                    key={s.date}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    onClick={() => handleDelete(s.date)}
                    disabled={deleting}
                  >
                    <span>{formatDate(s.date)}</span>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

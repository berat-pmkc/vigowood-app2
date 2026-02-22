"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MontajSessionStatusBadge } from "../components/montaj-session-status-badge";
import { EditSessionDialog } from "../components/edit-session-dialog";
import type { CompletedMontajSession } from "../components/completed-sessions-sheet";
import { getCompletedSessions } from "../actions";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { getSkuBadgeStyle } from "@/lib/sku-colors";
import {
  ArrowLeft,
  Check,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Users,
  CheckCircle,
  X,
} from "lucide-react";
import Link from "next/link";

interface ProductOption {
  sku: string;
  urun_adi: string;
}

interface CompletedSessionsClientProps {
  productOptions: ProductOption[];
}

type Period = "today" | "week" | "month" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Bugün",
  week: "Hafta",
  month: "Ay",
  all: "Tümü",
};

export function CompletedSessionsClient({ productOptions }: CompletedSessionsClientProps) {
  const [sessions, setSessions] = useState<CompletedMontajSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Filters
  const [period, setPeriod] = useState<Period>("week");
  const [selectedSku, setSelectedSku] = useState("");
  const [skuComboOpen, setSkuComboOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Edit dialog
  const [editSession, setEditSession] = useState<CompletedMontajSession | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const result = await getCompletedSessions({
      period: dateFrom || dateTo ? undefined : period,
      sku: selectedSku || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      pageSize,
    });
    if (result.success) {
      setSessions(result.data as CompletedMontajSession[]);
      setTotal(result.total);
    }
    setLoading(false);
  }, [period, selectedSku, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [period, selectedSku, dateFrom, dateTo]);

  const totalPages = Math.ceil(total / pageSize);

  const clearFilters = () => {
    setPeriod("week");
    setSelectedSku("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const hasActiveFilters = selectedSku || dateFrom || dateTo || period !== "week";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/uretim/montaj">
          <Button variant="ghost" size="sm" className="h-8 px-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Tamamlanan Seanslar
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} kayıt
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Period toggle */}
        <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <Button
              key={p}
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2.5 text-xs",
                period === p && !dateFrom && !dateTo && "bg-background shadow-sm font-medium"
              )}
              onClick={() => {
                setPeriod(p);
                setDateFrom("");
                setDateTo("");
              }}
            >
              {PERIOD_LABELS[p]}
            </Button>
          ))}
        </div>

        {/* Date range */}
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-8 w-36 text-xs"
          placeholder="Başlangıç"
        />
        <span className="text-xs text-muted-foreground">—</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-8 w-36 text-xs"
          placeholder="Bitiş"
        />

        {/* SKU filter */}
        <Popover open={skuComboOpen} onOpenChange={setSkuComboOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              size="sm"
              className="h-8 w-44 justify-between text-xs"
            >
              <span className="truncate">
                {selectedSku
                  ? productOptions.find((p) => p.sku === selectedSku)?.urun_adi ?? selectedSku
                  : "Tüm Ürünler"}
              </span>
              <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Ürün Ara..." />
              <CommandList>
                <CommandEmpty>Ürün bulunamadı</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="__all__"
                    onSelect={() => {
                      setSelectedSku("");
                      setSkuComboOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3 w-3",
                        !selectedSku ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="text-xs">Tüm Ürünler</span>
                  </CommandItem>
                  {productOptions.map((p) => (
                    <CommandItem
                      key={p.sku}
                      value={`${p.sku} ${p.urun_adi}`}
                      onSelect={() => {
                        setSelectedSku(p.sku);
                        setSkuComboOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3 w-3",
                          selectedSku === p.sku ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="text-xs truncate">{p.sku}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground"
            onClick={clearFilters}
          >
            <X className="w-3 h-3 mr-1" />
            Temizle
          </Button>
        )}
      </div>

      {/* Session list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          Bu filtreler ile eşleşen seans bulunamadı
        </p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const workers = s.workers as Array<{ id: string; name: string }> | null;
            const skuStyle = s.sku ? getSkuBadgeStyle(s.sku) : null;
            return (
              <div
                key={s.session_id}
                className="border rounded-lg p-3 space-y-1.5 hover:bg-muted/30 transition-colors"
              >
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {skuStyle ? (
                      <span
                        className="font-bold text-xs px-2 py-0.5 rounded truncate"
                        style={{ backgroundColor: skuStyle.backgroundColor, color: skuStyle.color }}
                      >
                        {s.sku}
                      </span>
                    ) : (
                      <span className="font-medium text-sm truncate">—</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <MontajSessionStatusBadge durum={s.durum} />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => {
                        setEditSession(s);
                        setEditOpen(true);
                      }}
                      title="Düzenle"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Step info */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                    Adım {s.seq_no}: {s.step_name || "—"}
                  </Badge>
                  {s.is_final_step && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                      Son
                    </Badge>
                  )}
                </div>

                {/* Details */}
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs block">Adet</span>
                    <span className="font-bold tabular-nums">{s.qty}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Süre</span>
                    <span className="tabular-nums text-xs">
                      {formatDuration(s.start_time, s.end_time)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">dk/Birim</span>
                    <span className="font-medium tabular-nums">
                      {s.birim_montaj_dk != null ? `${s.birim_montaj_dk}` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Tarih</span>
                    <span className="tabular-nums text-xs">
                      {s.end_time
                        ? new Date(s.end_time).toLocaleDateString("tr-TR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </span>
                  </div>
                </div>

                {/* Workers */}
                {workers && workers.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="w-3 h-3" />
                    {workers.map((w) => w.name).join(", ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs px-2 tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit dialog */}
      <EditSessionDialog
        session={editSession}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { MAKINE_DURUM_COLORS, MAKINE_DURUM_LABELS, type MakineDurum } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface BakimLogRow {
  id: string;
  makine_id: string;
  durum: string;
  neden: string | null;
  degistiren: string | null;
  created_at: string;
  sure_ms: number | null; // null = devam ediyor
}

interface BakimGecmisiTableProps {
  data: BakimLogRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  makineFilter: string;
  durumFilter: string;
  makineOptions: string[];
  userNames: Record<string, string>;
}

function formatSure(ms: number | null): string {
  if (ms === null) return "";
  const totalMinutes = Math.floor(ms / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);
  const minutes = totalMinutes % 60;
  const hours = totalHours % 24;

  if (totalDays > 0) {
    return `${totalDays}g ${hours}s`;
  }
  if (totalHours > 0) {
    return `${totalHours}s ${minutes}dk`;
  }
  return `${totalMinutes}dk`;
}

function formatTarih(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BakimGecmisiTable({
  data,
  totalCount,
  page,
  pageSize,
  makineFilter,
  durumFilter,
  makineOptions,
  userNames,
}: BakimGecmisiTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "tumu") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key !== "sayfa") params.delete("sayfa");
    router.push(`?${params.toString()}`);
  };

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p > 0) {
      params.set("sayfa", String(p));
    } else {
      params.delete("sayfa");
    }
    router.push(`?${params.toString()}`);
  };

  const changePageSize = (size: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("pageSize", String(size));
    params.delete("sayfa");
    router.push(`?${params.toString()}`);
  };

  const pageCount = Math.ceil(totalCount / pageSize);

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select
          value={makineFilter || "tumu"}
          onValueChange={(v) => updateParam("makine", v)}
        >
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Makine" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tumu">Tüm Makineler</SelectItem>
            {makineOptions.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={durumFilter || "tumu"}
          onValueChange={(v) => updateParam("durum", v)}
        >
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tumu">Tüm Durumlar</SelectItem>
            <SelectItem value="aktif">Aktif</SelectItem>
            <SelectItem value="bakim">Bakımda</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground ml-auto">
          Toplam {totalCount.toLocaleString("tr-TR")} kayıt
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Makine</TableHead>
              <TableHead className="w-[100px]">Durum</TableHead>
              <TableHead>Neden</TableHead>
              <TableHead className="w-[140px]">Değiştiren</TableHead>
              <TableHead className="w-[140px]">Tarih</TableHead>
              <TableHead className="w-[100px] text-right">Süre</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Wrench className="h-8 w-8 text-muted-foreground/50" />
                    <p>Henüz bakım kaydı bulunmuyor</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => {
                const durumKey = row.durum as MakineDurum;
                const colors = MAKINE_DURUM_COLORS[durumKey] ?? { bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-500" };
                const label = MAKINE_DURUM_LABELS[durumKey] ?? row.durum;
                const displayName = row.degistiren
                  ? userNames[row.degistiren] || row.degistiren
                  : "—";

                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono font-semibold">{row.makine_id}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(colors.bg, colors.text, "border-0 gap-1.5")}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", colors.dot)} />
                        {label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[300px] truncate">
                      {row.neden || "—"}
                    </TableCell>
                    <TableCell>{displayName}</TableCell>
                    <TableCell className="tabular-nums">{formatTarih(row.created_at)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.sure_ms === null ? (
                        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-0">
                          Devam ediyor
                        </Badge>
                      ) : (
                        formatSure(row.sure_ms)
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex flex-col gap-2 px-2 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Toplam {totalCount.toLocaleString("tr-TR")} kayıt
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-sm text-muted-foreground">Sayfa başına</span>
              <Select
                value={`${pageSize}`}
                onValueChange={(v) => changePageSize(Number(v))}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent side="top">
                  {[25, 50, 100].map((size) => (
                    <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              <span className="sm:hidden">{page + 1}/{pageCount || 1}</span>
              <span className="hidden sm:inline">Sayfa {page + 1} / {pageCount || 1}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="hidden sm:flex h-8 w-8" onClick={() => goToPage(0)} disabled={page === 0}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(page - 1)} disabled={page === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(page + 1)} disabled={page >= pageCount - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="hidden sm:flex h-8 w-8" onClick={() => goToPage(pageCount - 1)} disabled={page >= pageCount - 1}>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

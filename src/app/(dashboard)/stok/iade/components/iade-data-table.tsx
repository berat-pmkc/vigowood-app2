"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatNumber } from "@/lib/utils";
import { IADE_DURUM_LABELS, IADE_DURUM_COLORS, AY_LABELS } from "@/lib/constants";
import type { IadeDurum } from "@/lib/constants";

export interface IadeRecord {
  iade_id: string;
  tarih: string | null;
  sku: string | null;
  urun_adi: string | null;
  qty: number;
  durum: string | null;
  iade_nedeni: string | null;
  musteri_bilgisi: string | null;
  operator: string | null;
  created_at: string;
}

interface IadeDataTableProps {
  data: IadeRecord[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  durum: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  ay: string;
}

function getColumns(): ColumnDef<IadeRecord>[] {
  return [
    {
      accessorKey: "tarih",
      header: () => <span className="text-xs font-medium">Tarih</span>,
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap tabular-nums">
          {formatDate(row.original.tarih)}
        </span>
      ),
      size: 100,
      enableSorting: false,
    },
    {
      accessorKey: "sku",
      header: () => <span className="text-xs font-medium">Ürün Kodu</span>,
      cell: ({ row }) => (
        <span className="font-mono text-xs sm:text-sm whitespace-nowrap">
          {row.original.sku || "—"}
        </span>
      ),
      size: 120,
      enableSorting: false,
    },
    {
      accessorKey: "qty",
      header: () => <span className="text-xs font-medium">Adet</span>,
      cell: ({ row }) => {
        const durum = row.original.durum as IadeDurum | null;
        const isUsable = durum === "Kullanilabilir";
        return (
          <span className={`font-medium tabular-nums text-sm ${isUsable ? "text-emerald-700" : "text-red-600"}`}>
            {formatNumber(row.original.qty)}
          </span>
        );
      },
      size: 80,
      enableSorting: false,
    },
    {
      accessorKey: "durum",
      header: () => <span className="text-xs font-medium">Durum</span>,
      cell: ({ row }) => {
        const durum = row.original.durum as IadeDurum | null;
        if (!durum) return <span className="text-sm text-muted-foreground">—</span>;
        const colors = IADE_DURUM_COLORS[durum];
        const label = IADE_DURUM_LABELS[durum];
        return colors ? (
          <Badge className={`${colors.bg} ${colors.text} hover:${colors.bg}`}>
            {label || durum}
          </Badge>
        ) : (
          <Badge variant="outline">{durum}</Badge>
        );
      },
      meta: { className: "hidden sm:table-cell" },
      size: 130,
      enableSorting: false,
    },
  ];
}

function formatMonthLabel(ay: string): string {
  const [year, month] = ay.split("-").map(Number);
  return `${AY_LABELS[month - 1]} ${year}`;
}

function shiftMonth(ay: string, delta: number): string {
  const [year, month] = ay.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function IadeDataTable({
  data,
  totalCount,
  pageIndex,
  pageSize,
  search,
  durum,
  sortBy,
  sortOrder,
  ay,
}: IadeDataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(search);
  const [, startTransition] = useTransition();

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const isCurrentMonth = ay === currentMonth;

  const buildUrl = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      return `/stok/iade?${params.toString()}`;
    },
    [searchParams]
  );

  const navigate = useCallback(
    (updates: Record<string, string | undefined>) => {
      startTransition(() => {
        router.push(buildUrl(updates));
      });
    },
    [buildUrl, router]
  );

  const sorting: SortingState = useMemo(
    () => [{ id: sortBy, desc: sortOrder === "desc" }],
    [sortBy, sortOrder]
  );

  const columns = useMemo(() => getColumns(), []);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination: { pageIndex, pageSize },
    },
    pageCount: Math.ceil(totalCount / pageSize),
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    getRowId: (row) => row.iade_id,
  });

  return (
    <div className="space-y-4">
      {/* Month Navigator */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate({ ay: shiftMonth(ay, -1), page: "0" })}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[140px] text-center text-sm font-medium">
          {formatMonthLabel(ay)}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate({ ay: shiftMonth(ay, 1), page: "0" })}
          disabled={isCurrentMonth}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="SKU ara..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                navigate({ search: searchInput || undefined, page: "0" });
              }
            }}
            onBlur={() => {
              if (searchInput !== search) {
                navigate({ search: searchInput || undefined, page: "0" });
              }
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={durum || "all"}
          onValueChange={(v) =>
            navigate({ durum: v === "all" ? undefined : v, page: "0" })
          }
        >
          <SelectTrigger className="w-[140px] sm:w-[180px]">
            <SelectValue placeholder="Tüm Durumlar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            <SelectItem value="Kullanilabilir">Kullanılabilir</SelectItem>
            <SelectItem value="Kullanilamaz">Kullanılamaz</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable table={table} emptyMessage="İade kaydı bulunamadı." />

      <DataTablePagination
        table={table}
        totalCount={totalCount}
        onPageChange={(page) => navigate({ page: String(page) })}
        onPageSizeChange={(size) =>
          navigate({ pageSize: String(size), page: "0" })
        }
      />
    </div>
  );
}

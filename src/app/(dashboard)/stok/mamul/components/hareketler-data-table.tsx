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
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ArrowUp, ArrowDown } from "lucide-react";
import { formatNumber, formatDate, formatTime } from "@/lib/utils";

export interface StokMovement {
  id: string;
  mov_id: string | null;
  tarih: string | null;
  sku: string | null;
  urun_adi: string | null;
  qty: number;
  source: string | null;
  source_row_id: string | null;
  batch_id: string | null;
  created_at: string;
}

interface HareketlerDataTableProps {
  data: StokMovement[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  source: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

const SOURCES = [
  { value: "Paketleme", label: "Paketleme" },
  { value: "Satis", label: "Satış" },
  { value: "iade", label: "İade" },
  { value: "Duzeltme", label: "Düzeltme" },
] as const;

function getColumns(onSort: (id: string, desc: boolean) => void): ColumnDef<StokMovement>[] {
  return [
    {
      accessorKey: "tarih",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tarih" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <div className="text-sm">
          <div>{formatDate(row.original.tarih)}</div>
          <div className="text-xs text-muted-foreground">
            {formatTime(row.original.tarih)}
          </div>
        </div>
      ),
      size: 120,
    },
    {
      accessorKey: "sku",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="SKU" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <div>
          <span className="font-mono text-sm">{row.original.sku || "—"}</span>
          {row.original.urun_adi && (
            <div className="max-w-[160px] truncate text-xs text-muted-foreground">
              {row.original.urun_adi}
            </div>
          )}
        </div>
      ),
      size: 180,
    },
    {
      accessorKey: "qty",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Miktar" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const qty = row.original.qty;
        if (qty > 0) {
          return (
            <div className="flex items-center gap-1">
              <ArrowUp className="h-3.5 w-3.5 text-emerald-600" />
              <span className="font-medium tabular-nums text-emerald-700">
                +{formatNumber(qty)}
              </span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-1">
            <ArrowDown className="h-3.5 w-3.5 text-red-600" />
            <span className="font-medium tabular-nums text-red-700">
              {formatNumber(qty)}
            </span>
          </div>
        );
      },
      size: 100,
    },
    {
      accessorKey: "source",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Kaynak" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const source = row.original.source;
        const colorMap: Record<string, string> = {
          Paketleme: "bg-emerald-100 text-emerald-800",
          Satis: "bg-blue-100 text-blue-800",
          iade: "bg-amber-100 text-amber-800",
          Duzeltme: "bg-purple-100 text-purple-800",
        };
        const labelMap: Record<string, string> = {
          Paketleme: "Paketleme",
          Satis: "Satış",
          iade: "İade",
          Duzeltme: "Düzeltme",
        };
        return source ? (
          <Badge className={`${colorMap[source] || "bg-gray-100 text-gray-800"} hover:${colorMap[source] || "bg-gray-100"}`}>
            {labelMap[source] || source}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        );
      },
      size: 110,
    },
    {
      accessorKey: "source_row_id",
      header: "Referans",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.source_row_id || "—"}
        </span>
      ),
      size: 140,
      enableSorting: false,
    },
  ];
}

export function HareketlerDataTable({
  data,
  totalCount,
  pageIndex,
  pageSize,
  search,
  source,
  sortBy,
  sortOrder,
}: HareketlerDataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(search);
  const [, startTransition] = useTransition();

  const buildUrl = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      // Always keep tab=hareketler
      params.set("tab", "hareketler");
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      return `/stok/mamul?${params.toString()}`;
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

  const handleSort = useCallback(
    (columnId: string, desc: boolean) => {
      navigate({
        mSortBy: columnId,
        mSortOrder: desc ? "desc" : "asc",
        mPage: "0",
      });
    },
    [navigate]
  );

  const sorting: SortingState = useMemo(
    () => [{ id: sortBy, desc: sortOrder === "desc" }],
    [sortBy, sortOrder]
  );

  const columns = useMemo(() => getColumns(handleSort), [handleSort]);

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
    getRowId: (row) => row.id,
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="SKU veya referans ara..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                navigate({ mSearch: searchInput || undefined, mPage: "0" });
              }
            }}
            onBlur={() => {
              if (searchInput !== search) {
                navigate({ mSearch: searchInput || undefined, mPage: "0" });
              }
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={source || "all"}
          onValueChange={(v) =>
            navigate({ mSource: v === "all" ? undefined : v, mPage: "0" })
          }
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Tüm Kaynaklar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Kaynaklar</SelectItem>
            {SOURCES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable table={table} emptyMessage="Stok hareketi bulunamadı." />

      <DataTablePagination
        table={table}
        totalCount={totalCount}
        onPageChange={(page) => navigate({ mPage: String(page) })}
        onPageSizeChange={(size) =>
          navigate({ mPageSize: String(size), mPage: "0" })
        }
      />
    </div>
  );
}

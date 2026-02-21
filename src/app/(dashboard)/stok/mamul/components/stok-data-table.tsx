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
import { Search } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

export interface StokProduct extends Product {
  son_hareket_tarihi: string | null;
}

interface StokDataTableProps {
  data: StokProduct[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  kategori: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

function StokBadge({ stok, kritik }: { stok: number; kritik: number }) {
  if (kritik <= 0) {
    return (
      <span className="font-medium tabular-nums">{formatNumber(stok)}</span>
    );
  }
  if (stok < kritik) {
    return (
      <Badge variant="destructive" className="tabular-nums font-medium">
        {formatNumber(stok)}
      </Badge>
    );
  }
  if (stok <= kritik * 1.5) {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 tabular-nums font-medium">
        {formatNumber(stok)}
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 tabular-nums font-medium">
      {formatNumber(stok)}
    </Badge>
  );
}

function getColumns(onSort: (id: string, desc: boolean) => void): ColumnDef<StokProduct>[] {
  return [
    {
      accessorKey: "sku",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ürün Kodu" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.sku}</span>
      ),
      size: 130,
    },
    {
      accessorKey: "gunluk_satis",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Günlük Satış" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm">
          {row.original.gunluk_satis > 0
            ? formatNumber(row.original.gunluk_satis)
            : "—"}
        </span>
      ),
      size: 110,
    },
    {
      accessorKey: "stok_aktif",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Mevcut Stok" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <StokBadge
          stok={row.original.stok_aktif}
          kritik={row.original.mamul_stok_kritik}
        />
      ),
      size: 120,
    },
    {
      accessorKey: "mamul_stok_kritik",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Kritik Stok" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original.mamul_stok_kritik > 0
            ? formatNumber(row.original.mamul_stok_kritik)
            : "—"}
        </span>
      ),
      size: 100,
    },
    {
      id: "durum",
      header: "Durum",
      cell: ({ row }) => {
        const { stok_aktif, mamul_stok_kritik } = row.original;
        if (mamul_stok_kritik <= 0) return null;
        if (stok_aktif < mamul_stok_kritik) {
          return (
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="text-xs text-red-600">Kritik</span>
            </div>
          );
        }
        if (stok_aktif <= mamul_stok_kritik * 1.5) {
          return (
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="text-xs text-amber-600">Düşük</span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-emerald-600">Yeterli</span>
          </div>
        );
      },
      size: 90,
      enableSorting: false,
    },
  ];
}

export function StokDataTable({
  data,
  totalCount,
  pageIndex,
  pageSize,
  search,
  kategori,
  sortBy,
  sortOrder,
}: StokDataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(search);
  const [, startTransition] = useTransition();

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
        sortBy: columnId,
        sortOrder: desc ? "desc" : "asc",
        page: "0",
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
    getRowId: (row) => row.sku,
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ürün kodu ara..."
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
      </div>

      <DataTable table={table} emptyMessage="Ürün bulunamadı." />

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

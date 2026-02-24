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
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { formatNumber, cn } from "@/lib/utils";
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

function getStokColor(stok: number, kritik: number) {
  if (kritik <= 0) {
    return { bg: "bg-slate-100", bar: "bg-slate-300", text: "text-slate-700" };
  }
  const ratio = stok / kritik;
  if (ratio < 0.5) {
    return { bg: "bg-red-50", bar: "bg-red-500", text: "text-red-700 font-semibold" };
  }
  if (ratio < 1.0) {
    return { bg: "bg-red-50", bar: "bg-red-400", text: "text-red-600 font-semibold" };
  }
  if (ratio < 1.5) {
    return { bg: "bg-amber-50", bar: "bg-amber-400", text: "text-amber-700" };
  }
  if (ratio < 3.0) {
    return { bg: "bg-emerald-50", bar: "bg-emerald-400", text: "text-emerald-700" };
  }
  return { bg: "bg-emerald-50", bar: "bg-emerald-500", text: "text-emerald-800" };
}

function StokCell({ stok, kritik }: { stok: number; kritik: number }) {
  const color = getStokColor(stok, kritik);
  const barPct = kritik > 0 ? Math.min((stok / kritik / 4) * 100, 100) : 50;

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className={cn("tabular-nums text-sm whitespace-nowrap", color.text)}>
        {formatNumber(stok)}
      </span>
      <div className={cn("h-3 flex-1 rounded-full overflow-hidden", color.bg)}>
        <div
          className={cn("h-full rounded-full transition-all", color.bar)}
          style={{ width: `${barPct}%` }}
        />
      </div>
    </div>
  );
}

function getColumns(): ColumnDef<StokProduct>[] {
  return [
    {
      accessorKey: "sku",
      header: () => <span className="text-xs font-medium">Ürün Kodu</span>,
      cell: ({ row }) => (
        <span className="font-mono text-xs sm:text-sm whitespace-nowrap">
          {row.original.sku}
        </span>
      ),
      size: 120,
      enableSorting: false,
    },
    {
      accessorKey: "gunluk_satis",
      header: () => <span className="text-xs font-medium">Günlük Satış</span>,
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original.gunluk_satis > 0
            ? formatNumber(row.original.gunluk_satis)
            : "—"}
        </span>
      ),
      meta: { className: "hidden sm:table-cell" },
      size: 100,
      enableSorting: false,
    },
    {
      accessorKey: "stok_aktif",
      header: () => <span className="text-xs font-medium">Stok</span>,
      cell: ({ row }) => (
        <StokCell
          stok={row.original.stok_aktif}
          kritik={row.original.mamul_stok_kritik}
        />
      ),
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
    getRowId: (row) => row.sku,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
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

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
import { Search, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
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

/** Tıklanınca sıralamayı değiştiren başlık. İlk tıklama büyükten küçüğe. */
function SortableHeader({
  label, col, sortBy, sortOrder, onSort, align = "left",
}: {
  label: string;
  col: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort: (col: string) => void;
  align?: "left" | "right";
}) {
  const aktif = sortBy === col;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className={cn(
        "flex items-center gap-1 text-xs font-medium transition-colors hover:text-foreground",
        aktif ? "text-foreground" : "text-muted-foreground",
        align === "right" && "ml-auto flex-row-reverse",
      )}
    >
      {label}
      {aktif ? (
        sortOrder === "desc" ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />
      ) : (
        <ChevronsUpDown className="size-3.5 opacity-40" />
      )}
    </button>
  );
}

function getColumns(
  sortBy: string,
  sortOrder: "asc" | "desc",
  onSort: (col: string) => void,
): ColumnDef<StokProduct>[] {
  return [
    {
      accessorKey: "sku",
      header: () => (
        <SortableHeader label="Ürün Kodu" col="sku"
          sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
      ),
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
      header: () => (
        <SortableHeader label="Günlük Satış" col="gunluk_satis"
          sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
      ),
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
      header: () => (
        <SortableHeader label="Stok" col="stok_aktif"
          sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
      ),
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

  /**
   * Başlığa tıklama: aynı kolonsa yön değişir, farklı kolonsa büyükten
   * küçüğe başlar (kullanıcı "önce büyükten küçüğe" istedi). Sayfa 0'a döner
   * ki sıralama baştan görünsün.
   */
  const handleSort = useCallback(
    (col: string) => {
      const yeniYon = sortBy === col && sortOrder === "desc" ? "asc" : "desc";
      navigate({ sortBy: col, sortOrder: yeniYon, page: "0" });
    },
    [sortBy, sortOrder, navigate]
  );

  const columns = useMemo(
    () => getColumns(sortBy, sortOrder, handleSort),
    [sortBy, sortOrder, handleSort]
  );

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

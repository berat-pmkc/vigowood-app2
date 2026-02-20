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
import { formatNumber, formatDate } from "@/lib/utils";

export interface ParcaStok {
  part_id: string;
  part_adi: string;
  yari_mamul_stok: number;
  hazir_eleman_kritik_stok: number;
  son_hareket_tarihi: string | null;
}

interface ParcaStokDataTableProps {
  data: ParcaStok[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  search: string;
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

function getColumns(onSort: (id: string, desc: boolean) => void): ColumnDef<ParcaStok>[] {
  return [
    {
      accessorKey: "part_id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Parça ID" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.part_id}</span>
      ),
      size: 140,
    },
    {
      accessorKey: "part_adi",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Parça Adı" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="max-w-[220px] truncate text-sm">
          {row.original.part_adi || "—"}
        </span>
      ),
      size: 240,
    },
    {
      accessorKey: "yari_mamul_stok",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Mevcut Stok" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <StokBadge
          stok={row.original.yari_mamul_stok}
          kritik={row.original.hazir_eleman_kritik_stok}
        />
      ),
      size: 120,
    },
    {
      accessorKey: "hazir_eleman_kritik_stok",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Kritik Eşik" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original.hazir_eleman_kritik_stok > 0
            ? formatNumber(row.original.hazir_eleman_kritik_stok)
            : "—"}
        </span>
      ),
      size: 100,
    },
    {
      accessorKey: "son_hareket_tarihi",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Son Hareket" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.son_hareket_tarihi)}
        </span>
      ),
      size: 120,
    },
    {
      id: "durum",
      header: "Durum",
      cell: ({ row }) => {
        const { yari_mamul_stok, hazir_eleman_kritik_stok } = row.original;
        if (hazir_eleman_kritik_stok <= 0) return null;
        if (yari_mamul_stok < hazir_eleman_kritik_stok) {
          return (
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="text-xs text-red-600">Kritik</span>
            </div>
          );
        }
        if (yari_mamul_stok <= hazir_eleman_kritik_stok * 1.5) {
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

export function ParcaStokDataTable({
  data,
  totalCount,
  pageIndex,
  pageSize,
  search,
  sortBy,
  sortOrder,
}: ParcaStokDataTableProps) {
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
      return `/stok/yari-mamul?${params.toString()}`;
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
    getRowId: (row) => row.part_id,
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Parça ID veya parça adı ara..."
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

      <DataTable table={table} emptyMessage="Parça bulunamadı." />

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

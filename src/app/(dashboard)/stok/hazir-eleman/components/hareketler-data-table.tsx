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
import { Input } from "@/components/ui/input";
import { Search, ArrowUp } from "lucide-react";
import { formatNumber, formatDate, formatTime } from "@/lib/utils";

export interface HazirElemanHareket {
  hakis_id: string;
  tarih: string;
  part_id: string | null;
  part_adi: string | null;
  qty: number;
  operator: string | null;
  not_text: string | null;
  created_at: string;
}

interface HareketlerDataTableProps {
  data: HazirElemanHareket[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

function getColumns(onSort: (id: string, desc: boolean) => void): ColumnDef<HazirElemanHareket>[] {
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
      accessorKey: "part_id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Parça" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <div>
          <span className="font-mono text-sm">{row.original.part_id || "—"}</span>
          {row.original.part_adi && (
            <div className="max-w-[160px] truncate text-xs text-muted-foreground">
              {row.original.part_adi}
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
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <ArrowUp className="h-3.5 w-3.5 text-emerald-600" />
          <span className="font-medium tabular-nums text-emerald-700">
            +{formatNumber(row.original.qty)}
          </span>
        </div>
      ),
      size: 100,
    },
    {
      accessorKey: "operator",
      header: "Operatör",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.operator || "—"}
        </span>
      ),
      size: 100,
      enableSorting: false,
      meta: { className: "hidden lg:table-cell" },
    },
    {
      accessorKey: "hakis_id",
      header: "Referans",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.hakis_id}
        </span>
      ),
      size: 160,
      enableSorting: false,
      meta: { className: "hidden lg:table-cell" },
    },
    {
      accessorKey: "not_text",
      header: "Not",
      cell: ({ row }) => (
        <span className="max-w-[150px] truncate text-xs text-muted-foreground">
          {row.original.not_text || "—"}
        </span>
      ),
      size: 150,
      enableSorting: false,
      meta: { className: "hidden lg:table-cell" },
    },
  ];
}

export function HareketlerDataTable({
  data,
  totalCount,
  pageIndex,
  pageSize,
  search,
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
      params.set("tab", "hareketler");
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      return `/stok/hazir-eleman?${params.toString()}`;
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
    getRowId: (row) => row.hakis_id,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Parça ID veya referans ara..."
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

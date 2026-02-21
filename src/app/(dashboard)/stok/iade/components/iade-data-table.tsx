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
import { Search } from "lucide-react";
import { formatNumber, formatDate, formatTime } from "@/lib/utils";
import { IADE_DURUM_LABELS, IADE_DURUM_COLORS } from "@/lib/constants";
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
}

function getColumns(onSort: (id: string, desc: boolean) => void): ColumnDef<IadeRecord>[] {
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
      accessorKey: "iade_id",
      header: "İade ID",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.iade_id}
        </span>
      ),
      size: 170,
      enableSorting: false,
      meta: { className: "hidden md:table-cell" },
    },
    {
      accessorKey: "sku",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ürün" onSort={onSort} />
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
      size: 200,
    },
    {
      accessorKey: "qty",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Adet" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">{formatNumber(row.original.qty)}</span>
      ),
      size: 80,
    },
    {
      accessorKey: "durum",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Durum" onSort={onSort} />
      ),
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
      size: 130,
    },
    {
      accessorKey: "iade_nedeni",
      header: "İade Nedeni",
      cell: ({ row }) => (
        <span className="max-w-[180px] truncate text-xs text-muted-foreground">
          {row.original.iade_nedeni || "—"}
        </span>
      ),
      size: 180,
      enableSorting: false,
      meta: { className: "hidden lg:table-cell" },
    },
    {
      accessorKey: "musteri_bilgisi",
      header: "Müşteri",
      cell: ({ row }) => (
        <span className="max-w-[120px] truncate text-xs text-muted-foreground">
          {row.original.musteri_bilgisi || "—"}
        </span>
      ),
      size: 120,
      enableSorting: false,
      meta: { className: "hidden lg:table-cell" },
    },
  ];
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
}: IadeDataTableProps) {
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
    getRowId: (row) => row.iade_id,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="SKU veya iade ID ara..."
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
          <SelectTrigger className="w-full sm:w-[180px]">
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

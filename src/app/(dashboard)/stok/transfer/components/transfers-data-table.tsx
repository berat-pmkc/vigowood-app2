"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  type ColumnDef,
} from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Search } from "lucide-react";
import { formatNumber, formatDate, formatTime } from "@/lib/utils";

export interface TransferRow {
  id: string;
  tarih: string | null;
  sku: string | null;
  urunAdi: string | null;
  kaynakDepoId: string | null;
  kaynakDepoAdi: string | null;
  hedefDepoId: string | null;
  hedefDepoAdi: string | null;
  miktar: number;
}

const columns: ColumnDef<TransferRow>[] = [
  {
    accessorKey: "tarih",
    header: "Tarih",
    cell: ({ row }) => (
      <div className="text-sm">
        <div>{formatDate(row.original.tarih)}</div>
        <div className="text-xs text-muted-foreground">{formatTime(row.original.tarih)}</div>
      </div>
    ),
    size: 110,
  },
  {
    accessorKey: "sku",
    header: "Ürün",
    cell: ({ row }) => (
      <div>
        <span className="font-mono text-sm">{row.original.sku || "—"}</span>
        {row.original.urunAdi && (
          <div className="max-w-[180px] truncate text-xs text-muted-foreground">
            {row.original.urunAdi}
          </div>
        )}
      </div>
    ),
    size: 200,
  },
  {
    id: "yon",
    header: "Depo",
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5 text-sm">
        <Badge variant="outline" className="font-normal">
          {row.original.kaynakDepoAdi || "—"}
        </Badge>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Badge variant="outline" className="font-normal">
          {row.original.hedefDepoAdi || "—"}
        </Badge>
      </div>
    ),
    size: 260,
  },
  {
    accessorKey: "miktar",
    header: "Miktar",
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">{formatNumber(row.original.miktar)}</span>
    ),
    size: 90,
  },
];

export function TransfersDataTable({ data }: { data: TransferRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.trim().toLowerCase();
    return data.filter(
      (r) =>
        r.sku?.toLowerCase().includes(q) ||
        r.urunAdi?.toLowerCase().includes(q),
    );
  }, [data, search]);

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="SKU veya ürün adı ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 sm:max-w-xs"
        />
      </div>
      <DataTable table={table} emptyMessage="Henüz depo transferi yapılmamış." />
    </div>
  );
}

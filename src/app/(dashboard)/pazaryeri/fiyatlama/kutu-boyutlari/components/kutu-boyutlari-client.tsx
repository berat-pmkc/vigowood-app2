"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
  flexRender,
} from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SimplePagination } from "../../../fiyatlama/components/simple-pagination";
import { Search, ExternalLink } from "lucide-react";
import Link from "next/link";

interface BoxRow {
  sku: string;
  urun_adi: string | null;
  kutu_en_cm: number;
  kutu_boy_cm: number;
  kutu_yukseklik_cm: number;
  desi: number;
}

interface Props {
  data: BoxRow[];
}

export function KutuBoyutlariClient({ data }: Props) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  const rows: BoxRow[] = useMemo(() => {
    return data.map((p: any) => ({
      sku: p.sku,
      urun_adi: p.urun_adi,
      kutu_en_cm: Number(p.kutu_en_cm) || 0,
      kutu_boy_cm: Number(p.kutu_boy_cm) || 0,
      kutu_yukseklik_cm: Number(p.kutu_yukseklik_cm) || 0,
      desi: Number(p.desi) || 0,
    }));
  }, [data]);

  const definedCount = rows.filter(r => r.desi > 0).length;

  const columns: ColumnDef<BoxRow>[] = useMemo(
    () => [
      {
        accessorKey: "sku",
        header: "SKU",
        size: 120,
        cell: ({ getValue }) => (
          <span className="font-mono text-sm font-medium">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "urun_adi",
        header: "Ürün Adı",
        size: 200,
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
            {getValue<string>() ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "kutu_en_cm",
        header: "En (cm)",
        size: 80,
        cell: ({ getValue }) => {
          const v = getValue<number>();
          return <span className="text-sm">{v > 0 ? v : "—"}</span>;
        },
      },
      {
        accessorKey: "kutu_boy_cm",
        header: "Boy (cm)",
        size: 80,
        cell: ({ getValue }) => {
          const v = getValue<number>();
          return <span className="text-sm">{v > 0 ? v : "—"}</span>;
        },
      },
      {
        accessorKey: "kutu_yukseklik_cm",
        header: "Yükseklik (cm)",
        size: 100,
        cell: ({ getValue }) => {
          const v = getValue<number>();
          return <span className="text-sm">{v > 0 ? v : "—"}</span>;
        },
      },
      {
        accessorKey: "desi",
        header: "Desi",
        size: 80,
        cell: ({ getValue }) => {
          const v = getValue<number>();
          return v > 0 ? (
            <Badge variant="outline">{v}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = filterValue.toLowerCase();
      return (
        row.original.sku.toLowerCase().includes(search) ||
        (row.original.urun_adi?.toLowerCase().includes(search) ?? false)
      );
    },
  });

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="SKU veya ürün ara..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {definedCount}/{rows.length} desi tanımlı
          </span>
        </div>
        <Link href="/admin/urunler" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
          <ExternalLink className="h-3.5 w-3.5" />
          Admin&apos;den düzenleyin
        </Link>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="cursor-pointer select-none text-xs"
                    style={{ width: header.getSize() }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && " ↑"}
                      {header.column.getIsSorted() === "desc" && " ↓"}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Ürün bulunamadı
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className={row.original.desi === 0 ? "bg-gray-50/50" : ""}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-1.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <SimplePagination table={table} />
    </>
  );
}

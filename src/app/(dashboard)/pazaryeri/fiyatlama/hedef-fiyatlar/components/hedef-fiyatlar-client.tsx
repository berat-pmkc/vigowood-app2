"use client";

import { useCallback, useMemo, useState, useTransition, useRef, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { Upload, Download, Search, Trash2, Loader2 } from "lucide-react";
import { upsertTargetPrice, deleteTargetPrice, bulkUpsertTargetPrices } from "../../../fiyatlama/actions";
import * as XLSX from "xlsx";

// Row type: all active products with optional target price data
interface HedefFiyatRow {
  sku: string;
  urun_adi: string | null;
  hedef_fiyat: number;
  toptan_hedef_fiyat: number;
  hedef_fiyat_kdv: number;
  toptan_hedef_fiyat_kdv: number;
  has_target: boolean; // whether this product has a target price entry
  aktif: boolean;
}

interface Props {
  products: Array<{ sku: string; urun_adi: string | null }>;
  targetPrices: Record<string, {
    hedef_fiyat: number;
    toptan_hedef_fiyat: number;
    hedef_fiyat_kdv: number;
    toptan_hedef_fiyat_kdv: number;
    aktif: boolean;
  }>;
}

// Inline editable cell
function InlineEditableCell({
  value,
  onSave,
}: {
  value: number;
  onSave: (val: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleStart = () => {
    setEditing(true);
    setLocalValue(value > 0 ? Math.round(value).toString() : "");
  };

  const handleCommit = () => {
    setEditing(false);
    const parsed = parseFloat(localValue);
    if (!isNaN(parsed) && parsed >= 0 && parsed !== value) {
      onSave(parsed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      handleCommit();
    }
    if (e.key === "Escape") setEditing(false);
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        step="1"
        min="0"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={handleKeyDown}
        className="h-7 w-24 px-1 text-right text-xs"
      />
    );
  }

  return (
    <span
      onClick={handleStart}
      className={`cursor-pointer rounded px-1.5 py-0.5 text-right text-xs font-medium transition-colors ${
        value > 0
          ? "bg-blue-50 text-blue-800 hover:bg-blue-100"
          : "bg-gray-50 text-gray-400 hover:bg-gray-100"
      }`}
    >
      {value > 0 ? `₺${Math.round(value).toFixed(0)}` : "—"}
    </span>
  );
}

export function HedefFiyatlarClient({ products, targetPrices }: Props) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  // Build rows: all active products with their target price (or empty)
  const rows: HedefFiyatRow[] = useMemo(() => {
    return products.map((p) => {
      const tp = targetPrices[p.sku];
      return {
        sku: p.sku,
        urun_adi: p.urun_adi,
        hedef_fiyat: tp ? Number(tp.hedef_fiyat) || 0 : 0,
        toptan_hedef_fiyat: tp ? Number(tp.toptan_hedef_fiyat) || 0 : 0,
        hedef_fiyat_kdv: tp ? Number(tp.hedef_fiyat_kdv) || 0 : 0,
        toptan_hedef_fiyat_kdv: tp ? Number(tp.toptan_hedef_fiyat_kdv) || 0 : 0,
        has_target: !!tp,
        aktif: tp?.aktif ?? true,
      };
    });
  }, [products, targetPrices]);

  const handleInlineSave = useCallback(
    (sku: string, field: "hedef_fiyat" | "toptan_hedef_fiyat", value: number) => {
      const tp = targetPrices[sku];
      const currentHedef = field === "hedef_fiyat" ? value : (tp ? Number(tp.hedef_fiyat) || 0 : 0);
      const currentToptan = field === "toptan_hedef_fiyat" ? value : (tp ? Number(tp.toptan_hedef_fiyat) || 0 : 0);

      startTransition(async () => {
        const result = await upsertTargetPrice({
          sku,
          hedef_fiyat: currentHedef,
          toptan_hedef_fiyat: currentToptan,
        });
        if (result.success) {
          toast.success(`${sku} hedef fiyat güncellendi`);
        } else {
          toast.error(result.error);
        }
      });
    },
    [targetPrices]
  );

  const handleDelete = useCallback((sku: string) => {
    if (!confirm(`${sku} hedef fiyatını silmek istediğinize emin misiniz?`)) return;
    startTransition(async () => {
      const result = await deleteTargetPrice(sku);
      if (result.success) {
        toast.success("Hedef fiyat silindi");
      } else {
        toast.error(result.error);
      }
    });
  }, []);

  const handleExcelUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        const uploadRows = jsonData.map((row) => ({
          sku: String(row["SKU"] || row["sku"] || row["Ürün Kodu"] || "").trim(),
          hedef_fiyat: Number(row["Hedef Fiyat"] || row["hedef_fiyat"] || row["Per.Std"] || row["perakende_standart"] || 0),
          toptan_hedef_fiyat: Number(row["Toptan Hedef"] || row["toptan_hedef_fiyat"] || row["Top.Std"] || row["toptan_standart"] || 0),
        })).filter(r => r.sku);

        if (uploadRows.length === 0) {
          toast.error("Excel'de geçerli satır bulunamadı");
          return;
        }

        startTransition(async () => {
          const result = await bulkUpsertTargetPrices(uploadRows);
          if (result.success) {
            toast.success(`${result.inserted} hedef fiyat güncellendi`);
            if (result.errors.length > 0) {
              toast.warning(`${result.errors.length} uyarı: ${result.errors.slice(0, 3).join(", ")}`);
            }
          } else {
            toast.error(result.errors.join(", "));
          }
        });
      } catch {
        toast.error("Excel dosyası okunamadı");
      }
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsBinaryString(file);
  }, []);

  const columns: ColumnDef<HedefFiyatRow>[] = useMemo(
    () => [
      {
        accessorKey: "sku",
        header: "SKU",
        size: 120,
        cell: ({ row }) => (
          <span className="font-mono text-sm font-medium">{row.original.sku}</span>
        ),
      },
      {
        id: "urun_adi",
        header: "Ürün Adı",
        size: 200,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
            {row.original.urun_adi ?? "—"}
          </span>
        ),
        filterFn: (row, _id, filterValue) => {
          const search = filterValue.toLowerCase();
          return (
            row.original.sku.toLowerCase().includes(search) ||
            (row.original.urun_adi?.toLowerCase().includes(search) ?? false)
          );
        },
      },
      {
        accessorKey: "hedef_fiyat",
        header: "Hedef Fiyat",
        size: 110,
        cell: ({ row }) => (
          <InlineEditableCell
            value={row.original.hedef_fiyat}
            onSave={(v) => handleInlineSave(row.original.sku, "hedef_fiyat", v)}
          />
        ),
      },
      {
        accessorKey: "hedef_fiyat_kdv",
        header: "Hedef +KDV",
        size: 100,
        cell: ({ row }) => {
          const v = row.original.hedef_fiyat;
          return (
            <span className="text-xs text-muted-foreground">
              {v > 0 ? `₺${Math.round(v * 1.1).toFixed(0)}` : "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "toptan_hedef_fiyat",
        header: "Toptan Hedef",
        size: 110,
        cell: ({ row }) => (
          <InlineEditableCell
            value={row.original.toptan_hedef_fiyat}
            onSave={(v) => handleInlineSave(row.original.sku, "toptan_hedef_fiyat", v)}
          />
        ),
      },
      {
        accessorKey: "toptan_hedef_fiyat_kdv",
        header: "Toptan +KDV",
        size: 100,
        cell: ({ row }) => {
          const v = row.original.toptan_hedef_fiyat;
          return (
            <span className="text-xs text-muted-foreground">
              {v > 0 ? `₺${Math.round(v * 1.1).toFixed(0)}` : "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "has_target",
        header: "Durum",
        size: 80,
        cell: ({ row }) => (
          <Badge variant={row.original.has_target ? "default" : "secondary"}>
            {row.original.has_target ? "Tanımlı" : "Boş"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        size: 40,
        cell: ({ row }) =>
          row.original.has_target ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row.original.sku);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          ) : null,
      },
    ],
    [handleInlineSave, handleDelete]
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

  const definedCount = rows.filter(r => r.has_target).length;

  const handleExcelDownload = useCallback(() => {
    const exportData = rows.map((r) => ({
      SKU: r.sku,
      "Ürün Adı": r.urun_adi ?? "",
      "Hedef Fiyat": r.hedef_fiyat > 0 ? Math.round(r.hedef_fiyat) : "",
      "Hedef +KDV": r.hedef_fiyat > 0 ? Math.round(r.hedef_fiyat * 1.1) : "",
      "Toptan Hedef": r.toptan_hedef_fiyat > 0 ? Math.round(r.toptan_hedef_fiyat) : "",
      "Toptan +KDV": r.toptan_hedef_fiyat > 0 ? Math.round(r.toptan_hedef_fiyat * 1.1) : "",
      Durum: r.has_target ? "Tanımlı" : "Boş",
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    ws["!cols"] = [{ wch: 14 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hedef Fiyatlar");
    XLSX.writeFile(wb, `hedef-fiyatlar-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [rows]);

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
            {definedCount}/{rows.length} tanımlı
          </span>
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleExcelUpload}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExcelDownload}
          >
            <Download className="mr-1 h-4 w-4" />
            Excel İndir
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={isPending}
          >
            <Upload className="mr-1 h-4 w-4" />
            Excel ile Güncelle
          </Button>
        </div>
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
                <TableRow
                  key={row.id}
                  className={row.original.has_target ? "" : "bg-gray-50/50"}
                >
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

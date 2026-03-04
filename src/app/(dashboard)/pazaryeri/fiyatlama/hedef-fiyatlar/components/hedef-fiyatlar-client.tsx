"use client";

import { useCallback, useMemo, useState, useTransition, useRef } from "react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SimplePagination } from "../../../fiyatlama/components/simple-pagination";
import { toast } from "sonner";
import { Plus, Upload, Search, Trash2 } from "lucide-react";
import { upsertTargetPrice, deleteTargetPrice, bulkUpsertTargetPrices } from "../../../fiyatlama/actions";
import type { ProductTargetPrice } from "@/types/pricing";
import * as XLSX from "xlsx";

interface Props {
  data: ProductTargetPrice[];
  productMap: Record<string, string>;
  allSkus: string[];
}

export function HedefFiyatlarClient({ data, productMap, allSkus }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProductTargetPrice | null>(null);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formSku, setFormSku] = useState("");
  const [formPerMin, setFormPerMin] = useState(0);
  const [formPerStd, setFormPerStd] = useState(0);
  const [formTopMin, setFormTopMin] = useState(0);
  const [formTopStd, setFormTopStd] = useState(0);
  const [skuSearch, setSkuSearch] = useState("");

  const openCreate = useCallback(() => {
    setEditItem(null);
    setFormSku("");
    setFormPerMin(0);
    setFormPerStd(0);
    setFormTopMin(0);
    setFormTopStd(0);
    setSkuSearch("");
    setSheetOpen(true);
  }, []);

  const openEdit = useCallback((item: ProductTargetPrice) => {
    setEditItem(item);
    setFormSku(item.sku);
    setFormPerMin(item.perakende_min);
    setFormPerStd(item.perakende_standart);
    setFormTopMin(item.toptan_min);
    setFormTopStd(item.toptan_standart);
    setSheetOpen(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!formSku) {
      toast.error("SKU seçimi gereklidir");
      return;
    }
    startTransition(async () => {
      const result = await upsertTargetPrice({
        sku: formSku,
        perakende_min: formPerMin,
        perakende_standart: formPerStd,
        toptan_min: formTopMin,
        toptan_standart: formTopStd,
      });
      if (result.success) {
        toast.success(editItem ? "Hedef fiyat güncellendi" : "Hedef fiyat eklendi");
        setSheetOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }, [formSku, formPerMin, formPerStd, formTopMin, formTopStd, editItem]);

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

        const rows = jsonData.map((row) => ({
          sku: String(row["SKU"] || row["sku"] || row["Ürün Kodu"] || "").trim(),
          perakende_min: Number(row["Per.Min"] || row["perakende_min"] || 0),
          perakende_standart: Number(row["Per.Std"] || row["perakende_standart"] || 0),
          toptan_min: Number(row["Top.Min"] || row["toptan_min"] || 0),
          toptan_standart: Number(row["Top.Std"] || row["toptan_standart"] || 0),
        })).filter(r => r.sku);

        if (rows.length === 0) {
          toast.error("Excel'de geçerli satır bulunamadı");
          return;
        }

        startTransition(async () => {
          const result = await bulkUpsertTargetPrices(rows);
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
      // Reset file input
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsBinaryString(file);
  }, []);

  const formatPrice = (v: number) => v > 0 ? `${v.toLocaleString("tr-TR")} ₺` : "-";

  const columns: ColumnDef<ProductTargetPrice>[] = useMemo(
    () => [
      {
        accessorKey: "sku",
        header: "SKU",
        cell: ({ row }) => (
          <span className="font-mono text-sm font-medium">{row.original.sku}</span>
        ),
      },
      {
        id: "urun_adi",
        header: "Ürün Adı",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {productMap[row.original.sku] ?? "-"}
          </span>
        ),
      },
      {
        accessorKey: "perakende_min",
        header: "Per. Min",
        cell: ({ row }) => formatPrice(row.original.perakende_min),
      },
      {
        accessorKey: "perakende_standart",
        header: "Per. Std",
        cell: ({ row }) => formatPrice(row.original.perakende_standart),
      },
      {
        accessorKey: "perakende_min_kdv",
        header: "Per. Min+KDV",
        cell: ({ row }) => formatPrice(row.original.perakende_min_kdv),
      },
      {
        accessorKey: "perakende_standart_kdv",
        header: "Per. Std+KDV",
        cell: ({ row }) => formatPrice(row.original.perakende_standart_kdv),
      },
      {
        accessorKey: "toptan_min",
        header: "Top. Min",
        cell: ({ row }) => formatPrice(row.original.toptan_min),
      },
      {
        accessorKey: "toptan_standart",
        header: "Top. Std",
        cell: ({ row }) => formatPrice(row.original.toptan_standart),
      },
      {
        accessorKey: "aktif",
        header: "Aktif",
        cell: ({ row }) => (
          <Badge variant={row.original.aktif ? "default" : "secondary"}>
            {row.original.aktif ? "Aktif" : "Pasif"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
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
        ),
      },
    ],
    [productMap, handleDelete]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  // SKU autocomplete for create
  const filteredSkus = useMemo(() => {
    const existingSkus = new Set(data.map((d) => d.sku));
    return allSkus
      .filter((s) => !existingSkus.has(s))
      .filter((s) => !skuSearch || s.toLowerCase().includes(skuSearch.toLowerCase()));
  }, [allSkus, data, skuSearch]);

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="SKU veya ürün ara..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
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
            onClick={() => fileRef.current?.click()}
            disabled={isPending}
          >
            <Upload className="mr-1 h-4 w-4" />
            Excel ile Güncelle
          </Button>
          <Button size="sm" onClick={openCreate} disabled={isPending}>
            <Plus className="mr-1 h-4 w-4" />
            Yeni Hedef Fiyat
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
                    className="cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Hedef fiyat bulunamadı
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openEdit(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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

      {/* Edit/Create Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editItem ? "Hedef Fiyat Düzenle" : "Yeni Hedef Fiyat"}</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* SKU Select */}
            <div className="space-y-2">
              <Label>SKU</Label>
              {editItem ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">{editItem.sku}</Badge>
                  <span className="text-sm text-muted-foreground">{productMap[editItem.sku]}</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <Input
                    placeholder="SKU ara..."
                    value={skuSearch}
                    onChange={(e) => setSkuSearch(e.target.value)}
                  />
                  {skuSearch && (
                    <div className="max-h-40 overflow-y-auto rounded border bg-popover">
                      {filteredSkus.slice(0, 20).map((sku) => (
                        <button
                          key={sku}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
                          onClick={() => {
                            setFormSku(sku);
                            setSkuSearch(sku);
                          }}
                        >
                          <span className="font-mono">{sku}</span>
                          <span className="text-muted-foreground">{productMap[sku]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {formSku && (
                    <Badge variant="secondary" className="font-mono">{formSku}</Badge>
                  )}
                </div>
              )}
            </div>

            {/* Price Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Perakende Min</Label>
                <Input
                  type="number"
                  value={formPerMin}
                  onChange={(e) => setFormPerMin(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  +KDV: {(formPerMin * 1.1).toFixed(0)} ₺
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Perakende Standart</Label>
                <Input
                  type="number"
                  value={formPerStd}
                  onChange={(e) => setFormPerStd(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  +KDV: {(formPerStd * 1.1).toFixed(0)} ₺
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Toptan Min</Label>
                <Input
                  type="number"
                  value={formTopMin}
                  onChange={(e) => setFormTopMin(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  +KDV: {(formTopMin * 1.1).toFixed(0)} ₺
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Toptan Standart</Label>
                <Input
                  type="number"
                  value={formTopStd}
                  onChange={(e) => setFormTopStd(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  +KDV: {(formTopStd * 1.1).toFixed(0)} ₺
                </p>
              </div>
            </div>

            <Button onClick={handleSave} disabled={isPending} className="w-full">
              {isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

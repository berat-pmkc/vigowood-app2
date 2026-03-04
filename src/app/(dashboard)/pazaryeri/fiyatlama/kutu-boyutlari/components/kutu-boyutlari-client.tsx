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
import { upsertBoxDimension, deleteBoxDimension, bulkUpsertBoxDimensions } from "../../../fiyatlama/actions";
import type { ProductBoxDimension } from "@/types/pricing";
import * as XLSX from "xlsx";

interface Props {
  data: ProductBoxDimension[];
  productMap: Record<string, string>;
  allSkus: string[];
}

export function KutuBoyutlariClient({ data, productMap, allSkus }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProductBoxDimension | null>(null);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const [formSku, setFormSku] = useState("");
  const [formEn, setFormEn] = useState(0);
  const [formBoy, setFormBoy] = useState(0);
  const [formYukseklik, setFormYukseklik] = useState(0);
  const [skuSearch, setSkuSearch] = useState("");

  const desiHesapla = (en: number, boy: number, yukseklik: number) =>
    en > 0 && boy > 0 && yukseklik > 0 ? Math.ceil((en * boy * yukseklik) / 3000) : 0;

  const openCreate = useCallback(() => {
    setEditItem(null);
    setFormSku("");
    setFormEn(0);
    setFormBoy(0);
    setFormYukseklik(0);
    setSkuSearch("");
    setSheetOpen(true);
  }, []);

  const openEdit = useCallback((item: ProductBoxDimension) => {
    setEditItem(item);
    setFormSku(item.sku);
    setFormEn(item.en_cm);
    setFormBoy(item.boy_cm);
    setFormYukseklik(item.yukseklik_cm);
    setSheetOpen(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!formSku) {
      toast.error("SKU seçimi gereklidir");
      return;
    }
    startTransition(async () => {
      const result = await upsertBoxDimension({
        sku: formSku,
        en_cm: formEn,
        boy_cm: formBoy,
        yukseklik_cm: formYukseklik,
      });
      if (result.success) {
        toast.success(editItem ? "Kutu boyutu güncellendi" : "Kutu boyutu eklendi");
        setSheetOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }, [formSku, formEn, formBoy, formYukseklik, editItem]);

  const handleDelete = useCallback((sku: string) => {
    if (!confirm(`${sku} kutu boyutunu silmek istediğinize emin misiniz?`)) return;
    startTransition(async () => {
      const result = await deleteBoxDimension(sku);
      if (result.success) {
        toast.success("Kutu boyutu silindi");
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
          en_cm: Number(row["En"] || row["en_cm"] || row["En (cm)"] || 0),
          boy_cm: Number(row["Boy"] || row["boy_cm"] || row["Boy (cm)"] || 0),
          yukseklik_cm: Number(row["Yükseklik"] || row["yukseklik_cm"] || row["Yükseklik (cm)"] || 0),
        })).filter(r => r.sku);

        if (rows.length === 0) {
          toast.error("Excel'de geçerli satır bulunamadı");
          return;
        }

        startTransition(async () => {
          const result = await bulkUpsertBoxDimensions(rows);
          if (result.success) {
            toast.success(`${result.inserted} kutu boyutu güncellendi`);
            if (result.errors.length > 0) {
              toast.warning(`${result.errors.length} uyarı`);
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

  const columns: ColumnDef<ProductBoxDimension>[] = useMemo(
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
        accessorKey: "en_cm",
        header: "En (cm)",
        cell: ({ row }) => row.original.en_cm,
      },
      {
        accessorKey: "boy_cm",
        header: "Boy (cm)",
        cell: ({ row }) => row.original.boy_cm,
      },
      {
        accessorKey: "yukseklik_cm",
        header: "Yükseklik (cm)",
        cell: ({ row }) => row.original.yukseklik_cm,
      },
      {
        accessorKey: "desi",
        header: "Desi",
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.desi}</Badge>
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

  const filteredSkus = useMemo(() => {
    const existingSkus = new Set(data.map((d) => d.sku));
    return allSkus
      .filter((s) => !existingSkus.has(s))
      .filter((s) => !skuSearch || s.toLowerCase().includes(skuSearch.toLowerCase()));
  }, [allSkus, data, skuSearch]);

  return (
    <>
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
            Yeni Kutu Boyutu
          </Button>
        </div>
      </div>

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
                  Kutu boyutu bulunamadı
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

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editItem ? "Kutu Boyutu Düzenle" : "Yeni Kutu Boyutu"}</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
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
                  {formSku && <Badge variant="secondary" className="font-mono">{formSku}</Badge>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">En (cm)</Label>
                <Input
                  type="number"
                  value={formEn}
                  onChange={(e) => setFormEn(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Boy (cm)</Label>
                <Input
                  type="number"
                  value={formBoy}
                  onChange={(e) => setFormBoy(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Yükseklik (cm)</Label>
                <Input
                  type="number"
                  value={formYukseklik}
                  onChange={(e) => setFormYukseklik(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-xs text-muted-foreground">Hesaplanan Desi</p>
              <p className="text-2xl font-bold">{desiHesapla(formEn, formBoy, formYukseklik)}</p>
              <p className="text-xs text-muted-foreground">
                = ceil({formEn} × {formBoy} × {formYukseklik} / 3000)
              </p>
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

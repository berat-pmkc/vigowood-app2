"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { type Table } from "@tanstack/react-table";
import { Search, X, Download, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { bulkToggleActive, exportProducts, importProducts } from "../actions";
import { toast } from "sonner";
import { exportToExcel, type ExcelColumn } from "@/lib/excel-utils";
import { ExcelImportDialog } from "@/components/shared/excel-import-dialog";
import type { Database } from "@/lib/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

const PRODUCT_EXPORT_COLUMNS: ExcelColumn[] = [
  { key: "sku", header: "SKU", width: 20 },
  { key: "urun_adi", header: "Ürün Adı", width: 40 },
  { key: "kategori", header: "Kategori", width: 20 },
  { key: "aktif_mi", header: "Aktif", width: 10 },
  { key: "stok_aktif", header: "Stok", width: 12 },
  { key: "created_at", header: "Oluşturulma", width: 20 },
];

interface ProductsToolbarProps {
  table: Table<Product>;
  search: string;
  kategori: string;
  aktif: string;
  onSearchChange: (value: string) => void;
  onKategoriChange: (value: string) => void;
  onAktifChange: (value: string) => void;
  onBulkActionDone: () => void;
}

export function ProductsToolbar({
  table,
  search,
  kategori,
  aktif,
  onSearchChange,
  onKategoriChange,
  onAktifChange,
  onBulkActionDone,
}: ProductsToolbarProps) {
  const [searchInput, setSearchInput] = useState(search);
  const [isPending, startTransition] = useTransition();
  const [importOpen, setImportOpen] = useState(false);
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const hasSelection = selectedRows.length > 0;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        onSearchChange(searchInput);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search, onSearchChange]);

  const handleBulkToggle = useCallback(
    (aktifMi: boolean) => {
      const skus = selectedRows.map((r) => r.original.sku);
      startTransition(async () => {
        const result = await bulkToggleActive(skus, aktifMi);
        if (result.success) {
          toast.success(
            `${skus.length} ürün ${aktifMi ? "aktif" : "pasif"} yapıldı`
          );
          table.resetRowSelection();
          onBulkActionDone();
        } else {
          toast.error(result.error);
        }
      });
    },
    [selectedRows, table, onBulkActionDone]
  );

  const handleExport = () => {
    startTransition(async () => {
      const result = await exportProducts();
      if (result.success) {
        exportToExcel(
          result.data as unknown as Record<string, unknown>[],
          PRODUCT_EXPORT_COLUMNS,
          "vigowood-urunler"
        );
        toast.success(`${result.data.length} ürün dışa aktarıldı`);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleImport = async (rows: Record<string, string>[]) => {
    const result = await importProducts(
      rows.map((r) => ({
        sku: r["SKU"] || r["sku"] || "",
        urun_adi: r["Ürün Adı"] || r["urun_adi"] || "",
        kategori: r["Kategori"] || r["kategori"] || "",
        aktif_mi: r["Aktif"] || r["aktif_mi"] || "true",
      }))
    );
    if (result.success) {
      toast.success(`${result.count} ürün içe aktarıldı`);
      onBulkActionDone();
    } else {
      toast.error(result.error);
    }
  };

  const hasFilters = search || kategori || aktif;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="SKU veya ürün adı ara..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category filter */}
        <Select
          value={kategori || "__all__"}
          onValueChange={(v) => onKategoriChange(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Tüm Kategoriler" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tüm Kategoriler</SelectItem>
            {PRODUCT_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Active filter */}
        <Select
          value={aktif || "__all__"}
          onValueChange={(v) => onAktifChange(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-full sm:w-[130px]">
            <SelectValue placeholder="Tümü" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tümü</SelectItem>
            <SelectItem value="true">Aktif</SelectItem>
            <SelectItem value="false">Pasif</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput("");
              onSearchChange("");
              onKategoriChange("");
              onAktifChange("");
            }}
          >
            <X className="mr-1 h-4 w-4" />
            Temizle
          </Button>
        )}

        {/* Export / Import */}
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={handleExport}
            disabled={isPending}
            title="Excel'e Aktar"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setImportOpen(true)}
            title="Excel Yükle"
          >
            <Upload className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Bulk actions bar */}
      {hasSelection && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
          <span className="text-sm font-medium">
            {selectedRows.length} ürün seçildi
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => handleBulkToggle(true)}
            >
              Aktif Yap
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => handleBulkToggle(false)}
            >
              Pasif Yap
            </Button>
          </div>
        </div>
      )}

      <ExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Ürün İçe Aktar"
        description="Excel dosyasında SKU, Ürün Adı, Kategori, Aktif kolonları beklenir. Mevcut SKU varsa güncellenir."
        onConfirm={handleImport}
      />
    </div>
  );
}

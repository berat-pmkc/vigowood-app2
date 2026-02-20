"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { type Table } from "@tanstack/react-table";
import { Search, X } from "lucide-react";
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
import { bulkToggleActive } from "../actions";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

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
    </div>
  );
}

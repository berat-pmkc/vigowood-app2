"use client";

import { useEffect, useState, useTransition } from "react";
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
import { PART_TYPES, PART_TYPE_LABELS } from "@/lib/constants";
import { exportParts, importParts } from "../actions";
import { toast } from "sonner";
import { exportToExcel, type ExcelColumn } from "@/lib/excel-utils";
import { ExcelImportDialog } from "@/components/shared/excel-import-dialog";

const PART_EXPORT_COLUMNS: ExcelColumn[] = [
  { key: "part_id", header: "Parça ID", width: 20 },
  { key: "part_adi", header: "Parça Adı", width: 40 },
  { key: "part_type", header: "Tip", width: 15 },
  { key: "hazir_eleman_kritik_stok", header: "Kritik Stok", width: 15 },
  { key: "hazir_eleman_aktif_stok", header: "Hazır Eleman Stok", width: 18 },
  { key: "yari_mamul_stok", header: "Yarı Mamül Stok", width: 18 },
];

interface PartsToolbarProps {
  search: string;
  tip: string;
  onSearchChange: (value: string) => void;
  onTipChange: (value: string) => void;
}

export function PartsToolbar({
  search,
  tip,
  onSearchChange,
  onTipChange,
}: PartsToolbarProps) {
  const [searchInput, setSearchInput] = useState(search);
  const [isPending, startTransition] = useTransition();
  const [importOpen, setImportOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        onSearchChange(searchInput);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search, onSearchChange]);

  const handleExport = () => {
    startTransition(async () => {
      const result = await exportParts();
      if (result.success) {
        exportToExcel(
          result.data as unknown as Record<string, unknown>[],
          PART_EXPORT_COLUMNS,
          "vigowood-parcalar"
        );
        toast.success(`${result.data.length} parça dışa aktarıldı`);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleImport = async (rows: Record<string, string>[]) => {
    const result = await importParts(
      rows.map((r) => ({
        part_id: r["Parça ID"] || r["part_id"] || "",
        part_adi: r["Parça Adı"] || r["part_adi"] || "",
        part_type: r["Tip"] || r["part_type"] || "HAZIR",
        hazir_eleman_kritik_stok: r["Kritik Stok"] || r["hazir_eleman_kritik_stok"] || "0",
      }))
    );
    if (result.success) {
      toast.success(`${result.count} parça içe aktarıldı`);
    } else {
      toast.error(result.error);
    }
  };

  const hasFilters = search || tip;

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Parça ID veya adı ara..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Part type filter */}
        <Select
          value={tip || "__all__"}
          onValueChange={(v) => onTipChange(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Tüm Tipler" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tüm Tipler</SelectItem>
            {PART_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {PART_TYPE_LABELS[t]}
              </SelectItem>
            ))}
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
              onTipChange("");
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

      <ExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Parça İçe Aktar"
        description="Excel dosyasında Parça ID, Parça Adı, Tip (YARIMAMUL/HAZIR/KUTU/KARTON), Kritik Stok kolonları beklenir."
        onConfirm={handleImport}
      />
    </>
  );
}

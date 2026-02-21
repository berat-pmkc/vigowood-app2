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
import { MAKINE_IDS, MAKINE_LABELS } from "@/lib/constants";
import { exportPlakalar, importPlakalar } from "../actions";
import { toast } from "sonner";
import { exportToExcel, type ExcelColumn } from "@/lib/excel-utils";
import { ExcelImportDialog } from "@/components/shared/excel-import-dialog";

const PLAKA_EXPORT_COLUMNS: ExcelColumn[] = [
  { key: "plakalar_id", header: "Plaka ID", width: 15 },
  { key: "plaka_id", header: "Plaka Grubu", width: 15 },
  { key: "plaka_adi", header: "Plaka Adı", width: 35 },
  { key: "tipi", header: "Tip", width: 15 },
  { key: "renk", header: "Renk", width: 15 },
  { key: "makine_id", header: "Makine", width: 12 },
  { key: "std_kesim_suresi_dk", header: "Kesim Süresi (dk)", width: 18 },
  { key: "sku", header: "SKU", width: 15 },
];

interface PlakalarToolbarProps {
  search: string;
  makine: string;
  sku: string;
  skuOptions: string[];
  onSearchChange: (value: string) => void;
  onMakineChange: (value: string) => void;
  onSkuChange: (value: string) => void;
}

export function PlakalarToolbar({
  search,
  makine,
  sku,
  skuOptions,
  onSearchChange,
  onMakineChange,
  onSkuChange,
}: PlakalarToolbarProps) {
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
      const result = await exportPlakalar();
      if (result.success) {
        exportToExcel(
          result.data as unknown as Record<string, unknown>[],
          PLAKA_EXPORT_COLUMNS,
          "vigowood-plakalar"
        );
        toast.success(`${result.data.length} plaka dışa aktarıldı`);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleImport = async (rows: Record<string, string>[]) => {
    const result = await importPlakalar(
      rows.map((r) => ({
        plakalar_id: r["Plaka ID"] || r["plakalar_id"] || undefined,
        plaka_id: r["Plaka Grubu"] || r["plaka_id"] || "",
        plaka_adi: r["Plaka Adı"] || r["plaka_adi"] || "",
        tipi: r["Tip"] || r["tipi"] || undefined,
        renk: r["Renk"] || r["renk"] || undefined,
        makine_id: r["Makine"] || r["makine_id"] || "BÜYÜK",
        std_kesim_suresi_dk: r["Kesim Süresi (dk)"] || r["std_kesim_suresi_dk"] || undefined,
        sku: r["SKU"] || r["sku"] || undefined,
      }))
    );
    if (result.success) {
      toast.success(`${result.count} plaka içe aktarıldı`);
    } else {
      toast.error(result.error);
    }
  };

  const hasFilters = search || makine || sku;

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Plaka ID, adı veya SKU ara..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Machine filter */}
        <Select
          value={makine || "__all__"}
          onValueChange={(v) => onMakineChange(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Tüm Makineler" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tüm Makineler</SelectItem>
            {MAKINE_IDS.map((m) => (
              <SelectItem key={m} value={m}>
                {MAKINE_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* SKU filter */}
        <Select
          value={sku || "__all__"}
          onValueChange={(v) => onSkuChange(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Tüm Ürünler" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tüm Ürünler</SelectItem>
            {skuOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
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
              onMakineChange("");
              onSkuChange("");
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
        title="Plaka İçe Aktar"
        description="Excel dosyasında Plaka ID, Plaka Grubu, Plaka Adı, Tip, Renk, Makine, Kesim Süresi (dk), SKU kolonları beklenir."
        onConfirm={handleImport}
      />
    </>
  );
}

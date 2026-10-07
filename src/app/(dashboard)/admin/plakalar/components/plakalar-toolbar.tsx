"use client";

import { useEffect, useState, useTransition } from "react";
import { Search, X, Download, Upload, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportPlakalar, importPlakalar } from "../actions";
import { toast } from "sonner";
import { exportToExcel, type ExcelColumn } from "@/lib/excel-utils";
import { ExcelImportDialog } from "@/components/shared/excel-import-dialog";
import { PART_TYPES, PART_TYPE_LABELS } from "@/lib/constants";
import { isFilterActive, type Filters } from "./tree-filters";
import { MAKINELER } from "./tree-types";

const PLAKA_EXPORT_COLUMNS: ExcelColumn[] = [
  { key: "plakalar_id", header: "Plaka ID", width: 15 },
  { key: "plaka_id", header: "Plaka Grubu", width: 15 },
  { key: "plaka_adi", header: "Plaka Adı", width: 35 },
  { key: "tipi", header: "Tip", width: 15 },
  { key: "renk", header: "Renk", width: 15 },
  { key: "mak1_dk", header: "MAK-1 (dk)", width: 12 },
  { key: "mak2_dk", header: "MAK-2 (dk)", width: 12 },
  { key: "mak3_dk", header: "MAK-3 (dk)", width: 12 },
  { key: "sku", header: "SKU", width: 15 },
];

const ALL = "__all__";

interface Props {
  filters: Filters;
  onChange: (updates: Partial<Record<keyof Filters, string>>) => void;
  onClear: () => void;
  skuOptions: { sku: string; label: string }[];
  mdfOptions: string[];
  renkOptions: string[];
  view: "liste" | "parcalar";
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onImported: () => void;
}

function FilterSelect({
  value,
  onValueChange,
  placeholder,
  options,
  className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <Select value={value || ALL} onValueChange={(v) => onValueChange(v === ALL ? "" : v)}>
      <SelectTrigger className={className ?? "w-full sm:w-[150px]"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PlakalarToolbar({
  filters,
  onChange,
  onClear,
  skuOptions,
  mdfOptions,
  renkOptions,
  view,
  onExpandAll,
  onCollapseAll,
  onImported,
}: Props) {
  const [searchInput, setSearchInput] = useState(filters.q);
  const [isPending, startTransition] = useTransition();
  const [importOpen, setImportOpen] = useState(false);

  // URL'den gelen q değişirse (ör. Temizle) input'u eşitle
  useEffect(() => {
    setSearchInput(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (searchInput === filters.q) return;
    const t = setTimeout(() => onChange({ q: searchInput }), 300);
    return () => clearTimeout(t);
  }, [searchInput, filters.q, onChange]);

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
        mak1_dk: r["MAK-1 (dk)"] || r["mak1_dk"] || undefined,
        mak2_dk: r["MAK-2 (dk)"] || r["mak2_dk"] || undefined,
        mak3_dk: r["MAK-3 (dk)"] || r["mak3_dk"] || undefined,
        sku: r["SKU"] || r["sku"] || undefined,
      }))
    );
    if (result.success) {
      toast.success(`${result.count} plaka içe aktarıldı`);
      onImported();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <>
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ürün kodu, parça kodu/adı, plaka ara..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={onExpandAll} title="Tümünü aç">
              <ChevronsUpDown className="mr-1 h-4 w-4" />
              Aç
            </Button>
            <Button variant="outline" size="sm" onClick={onCollapseAll} title="Tümünü kapat">
              <ChevronsDownUp className="mr-1 h-4 w-4" />
              Kapat
            </Button>
            <Button variant="outline" size="icon" onClick={handleExport} disabled={isPending} title="Excel'e Aktar">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setImportOpen(true)} title="Excel Yükle">
              <Upload className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            value={filters.sku}
            onValueChange={(v) => onChange({ sku: v })}
            placeholder="Tüm Ürünler"
            options={skuOptions.map((s) => ({ value: s.sku, label: s.label }))}
            className="w-full sm:w-[200px]"
          />
          <FilterSelect
            value={filters.tip}
            onValueChange={(v) => onChange({ tip: v })}
            placeholder="Parça Tipi"
            options={PART_TYPES.map((t) => ({ value: t, label: PART_TYPE_LABELS[t] }))}
          />
          <FilterSelect
            value={filters.mdf}
            onValueChange={(v) => onChange({ mdf: v })}
            placeholder="MDF Tipi"
            options={mdfOptions.map((o) => ({ value: o, label: o }))}
          />
          <FilterSelect
            value={filters.renk}
            onValueChange={(v) => onChange({ renk: v })}
            placeholder="Renk"
            options={renkOptions.map((o) => ({ value: o, label: o }))}
          />
          <FilterSelect
            value={filters.mak}
            onValueChange={(v) => onChange({ mak: v })}
            placeholder="Makine"
            options={MAKINELER.map((m) => ({ value: m, label: m }))}
            className="w-full sm:w-[120px]"
          />
          {view === "liste" && (
            <Button
              variant={filters.plakasiz ? "default" : "outline"}
              size="sm"
              onClick={() => onChange({ plakasiz: filters.plakasiz ? "" : "1" })}
            >
              Plakası olmayanlar
            </Button>
          )}
          {isFilterActive(filters) && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              <X className="mr-1 h-4 w-4" />
              Temizle
            </Button>
          )}
        </div>
      </div>

      <ExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Plaka İçe Aktar"
        description="Excel dosyasında Plaka ID, Plaka Grubu, Plaka Adı, Tip, Renk, MAK-1 (dk), MAK-2 (dk), MAK-3 (dk), SKU kolonları beklenir."
        onConfirm={handleImport}
      />
    </>
  );
}

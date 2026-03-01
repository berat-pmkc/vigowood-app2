"use client";

import { useEffect, useState, useTransition } from "react";
import { Search, X, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HAZIR_ELEMAN_TURLERI } from "@/lib/constants";
import { exportHazirEleman } from "../actions";
import { toast } from "sonner";
import { exportToExcel, type ExcelColumn } from "@/lib/excel-utils";

const EXPORT_COLUMNS: ExcelColumn[] = [
  { key: "part_id", header: "Kod", width: 15 },
  { key: "part_adi", header: "Hazır Eleman Adı", width: 40 },
  { key: "tur", header: "Tür", width: 15 },
  { key: "hazir_eleman_aktif_stok", header: "Stok", width: 12 },
  { key: "hazir_eleman_kritik_stok", header: "Kritik Stok", width: 12 },
];

interface HazirElemanToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  tur: string;
  onTurChange: (value: string) => void;
}

export function HazirElemanToolbar({
  search,
  onSearchChange,
  tur,
  onTurChange,
}: HazirElemanToolbarProps) {
  const [searchInput, setSearchInput] = useState(search);
  const [isPending, startTransition] = useTransition();

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
      const result = await exportHazirEleman();
      if (result.success) {
        exportToExcel(
          result.data as unknown as Record<string, unknown>[],
          EXPORT_COLUMNS,
          "vigowood-hazir-eleman"
        );
        toast.success(`${result.data.length} hazır eleman dışa aktarıldı`);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Kod veya ad ile ara..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        {search && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput("");
              onSearchChange("");
            }}
          >
            <X className="mr-1 h-4 w-4" />
            Temizle
          </Button>
        )}

        <Button
          variant="outline"
          size="icon"
          onClick={handleExport}
          disabled={isPending}
          title="Excel'e Aktar"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Tür filtre butonları */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button
          variant={tur === "" ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onTurChange("")}
        >
          Tümü
        </Button>
        {HAZIR_ELEMAN_TURLERI.map((t) => (
          <Button
            key={t}
            variant={tur === t ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onTurChange(t)}
          >
            {t}
          </Button>
        ))}
      </div>
    </div>
  );
}

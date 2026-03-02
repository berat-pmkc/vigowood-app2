"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { MONTAJ_SESSION_STATUS, MONTAJ_SESSION_STATUS_LABELS } from "@/lib/constants";

interface MontajToolbarProps {
  search: string;
  durum: string;
  dateFrom: string;
  dateTo: string;
  onSearchChange: (value: string) => void;
  onDurumChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClear: () => void;
}

export function MontajToolbar({
  search,
  durum,
  dateFrom,
  dateTo,
  onSearchChange,
  onDurumChange,
  onDateFromChange,
  onDateToChange,
  onClear,
}: MontajToolbarProps) {
  const hasFilters = search || durum || dateFrom || dateTo;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Seans ID, SKU, Operatör ara..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-9 w-[220px]"
      />
      <Select value={durum || "all"} onValueChange={(v) => onDurumChange(v === "all" ? "" : v)}>
        <SelectTrigger className="h-9 w-[140px]">
          <SelectValue placeholder="Durum" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tüm Durumlar</SelectItem>
          {MONTAJ_SESSION_STATUS.map((s) => (
            <SelectItem key={s} value={s}>
              {MONTAJ_SESSION_STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        value={dateFrom}
        onChange={(e) => onDateFromChange(e.target.value)}
        className="h-9 w-[145px]"
      />
      <Input
        type="date"
        value={dateTo}
        onChange={(e) => onDateToChange(e.target.value)}
        className="h-9 w-[145px]"
      />
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-9 px-2">
          <X className="mr-1 h-4 w-4" />
          Temizle
        </Button>
      )}
    </div>
  );
}

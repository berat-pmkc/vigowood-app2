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
import { CUT_STATUS, CUT_STATUS_LABELS } from "@/lib/constants";

interface KesimToolbarProps {
  search: string;
  durum: string;
  makine: string;
  dateFrom: string;
  dateTo: string;
  onSearchChange: (value: string) => void;
  onDurumChange: (value: string) => void;
  onMakineChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClear: () => void;
}

const MAKINE_OPTIONS = ["MAK-1", "MAK-2", "MAK-3", "KUTU"];

export function KesimToolbar({
  search,
  durum,
  makine,
  dateFrom,
  dateTo,
  onSearchChange,
  onDurumChange,
  onMakineChange,
  onDateFromChange,
  onDateToChange,
  onClear,
}: KesimToolbarProps) {
  const hasFilters = search || durum || makine || dateFrom || dateTo;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Kesim ID, SKU, Plaka ara..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-9 w-[200px]"
      />
      <Select value={durum || "all"} onValueChange={(v) => onDurumChange(v === "all" ? "" : v)}>
        <SelectTrigger className="h-9 w-[140px]">
          <SelectValue placeholder="Durum" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tüm Durumlar</SelectItem>
          {CUT_STATUS.map((s) => (
            <SelectItem key={s} value={s}>
              {CUT_STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={makine || "all"} onValueChange={(v) => onMakineChange(v === "all" ? "" : v)}>
        <SelectTrigger className="h-9 w-[120px]">
          <SelectValue placeholder="Makine" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tüm Makineler</SelectItem>
          {MAKINE_OPTIONS.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        value={dateFrom}
        onChange={(e) => onDateFromChange(e.target.value)}
        className="h-9 w-[145px]"
        placeholder="Başlangıç"
      />
      <Input
        type="date"
        value={dateTo}
        onChange={(e) => onDateToChange(e.target.value)}
        className="h-9 w-[145px]"
        placeholder="Bitiş"
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

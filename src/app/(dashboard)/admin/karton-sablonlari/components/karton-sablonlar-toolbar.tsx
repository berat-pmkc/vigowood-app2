"use client";

import { useEffect, useState } from "react";
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
import { KUTU_TURLERI } from "@/lib/constants";

interface KartonSablonlarToolbarProps {
  search: string;
  sku: string;
  tur: string;
  skuOptions: string[];
  onSearchChange: (value: string) => void;
  onSkuChange: (value: string) => void;
  onTurChange: (value: string) => void;
}

export function KartonSablonlarToolbar({
  search,
  sku,
  tur,
  skuOptions,
  onSearchChange,
  onSkuChange,
  onTurChange,
}: KartonSablonlarToolbarProps) {
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        onSearchChange(searchInput);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search, onSearchChange]);

  const hasFilters = search || sku || tur;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Şablon ID veya SKU ara..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9"
        />
      </div>

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

      <Select
        value={tur || "__all__"}
        onValueChange={(v) => onTurChange(v === "__all__" ? "" : v)}
      >
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder="Tüm Türler" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Tüm Türler</SelectItem>
          {KUTU_TURLERI.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearchInput("");
            onSearchChange("");
            onSkuChange("");
            onTurChange("");
          }}
        >
          <X className="mr-1 h-4 w-4" />
          Temizle
        </Button>
      )}
    </div>
  );
}

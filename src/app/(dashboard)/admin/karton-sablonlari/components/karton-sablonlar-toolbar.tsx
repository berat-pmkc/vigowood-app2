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

interface KartonSablonlarToolbarProps {
  search: string;
  sku: string;
  skuOptions: string[];
  onSearchChange: (value: string) => void;
  onSkuChange: (value: string) => void;
}

export function KartonSablonlarToolbar({
  search,
  sku,
  skuOptions,
  onSearchChange,
  onSkuChange,
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

  const hasFilters = search || sku;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Şablon ID, adı veya SKU ara..."
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

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearchInput("");
            onSearchChange("");
            onSkuChange("");
          }}
        >
          <X className="mr-1 h-4 w-4" />
          Temizle
        </Button>
      )}
    </div>
  );
}

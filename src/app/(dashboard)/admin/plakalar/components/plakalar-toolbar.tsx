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
import { MAKINE_IDS, MAKINE_LABELS } from "@/lib/constants";

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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        onSearchChange(searchInput);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search, onSearchChange]);

  const hasFilters = search || makine || sku;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Plaka ID veya adı ara..."
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
    </div>
  );
}

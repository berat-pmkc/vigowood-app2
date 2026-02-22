"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X, Plus } from "lucide-react";
import type { ShipmentCountry } from "@/lib/shipment-settings-types";
import { useCallback, useState } from "react";

interface FiyatlarToolbarProps {
  search: string;
  countryCode: string;
  onAddNew: () => void;
  ulkeler: ShipmentCountry[];
}

export function FiyatlarToolbar({ search, countryCode, onAddNew, ulkeler }: FiyatlarToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(search);

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      router.push(`/sevkiyat/fiyatlar?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams("search", searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput("");
    updateParams("search", "");
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-2">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="SKU, ürün adı veya GTIP ara..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8 pr-8 h-9"
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        <Select
          value={countryCode || "all"}
          onValueChange={(v) => updateParams("country_code", v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Ülke" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Ülkeler</SelectItem>
            {ulkeler.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code} - {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={onAddNew} className="h-9">
        <Plus className="w-4 h-4 mr-1" />
        Yeni Fiyat
      </Button>
    </div>
  );
}

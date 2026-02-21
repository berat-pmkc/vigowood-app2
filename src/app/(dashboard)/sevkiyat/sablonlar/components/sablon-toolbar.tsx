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
import { PALET_BOYUTLARI } from "@/lib/constants";
import { useCallback, useState } from "react";

interface SablonToolbarProps {
  search: string;
  paletBoyut: string;
  onAddNew: () => void;
}

export function SablonToolbar({ search, paletBoyut, onAddNew }: SablonToolbarProps) {
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
      router.push(`/sevkiyat/sablonlar?${params.toString()}`);
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
            placeholder="SKU ara..."
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

        {/* Palet Boyutu filter */}
        <Select
          value={paletBoyut || "all"}
          onValueChange={(v) => updateParams("palet_boyut", v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Palet Boyutu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Boyutlar</SelectItem>
            {PALET_BOYUTLARI.map((b) => (
              <SelectItem key={b} value={b}>
                {b} cm
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={onAddNew} className="h-9">
        <Plus className="w-4 h-4 mr-1" />
        Yeni Şablon
      </Button>
    </div>
  );
}

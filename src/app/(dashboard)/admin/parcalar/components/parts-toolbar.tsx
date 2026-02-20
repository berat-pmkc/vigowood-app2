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
import { PART_TYPES, PART_TYPE_LABELS } from "@/lib/constants";

interface PartsToolbarProps {
  search: string;
  tip: string;
  onSearchChange: (value: string) => void;
  onTipChange: (value: string) => void;
}

export function PartsToolbar({
  search,
  tip,
  onSearchChange,
  onTipChange,
}: PartsToolbarProps) {
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

  const hasFilters = search || tip;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Parça ID veya adı ara..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Part type filter */}
      <Select
        value={tip || "__all__"}
        onValueChange={(v) => onTipChange(v === "__all__" ? "" : v)}
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Tüm Tipler" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Tüm Tipler</SelectItem>
          {PART_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {PART_TYPE_LABELS[t]}
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
            onTipChange("");
          }}
        >
          <X className="mr-1 h-4 w-4" />
          Temizle
        </Button>
      )}
    </div>
  );
}

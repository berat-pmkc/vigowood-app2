"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import {
  ODEME_TURLERI,
  ODEME_TURU_LABELS,
  ODEME_DURUMLARI,
  PARA_BIRIMLERI,
} from "@/lib/constants";

interface OdemelerToolbarProps {
  search: string;
  turu: string;
  durum: string;
  cinsi: string;
  dateFrom: string;
  dateTo: string;
}

export function OdemelerToolbar({
  search,
  turu,
  durum,
  cinsi,
  dateFrom,
  dateTo,
}: OdemelerToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(search);
  const [, startTransition] = useTransition();

  const buildUrl = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      return `/muhasebe/odemeler?${params.toString()}`;
    },
    [searchParams]
  );

  const navigate = useCallback(
    (updates: Record<string, string | undefined>) => {
      startTransition(() => {
        router.push(buildUrl(updates));
      });
    },
    [buildUrl, router]
  );

  const hasFilters = search || turu || durum || cinsi || dateFrom || dateTo;

  const clearFilters = () => {
    setSearchInput("");
    navigate({
      search: undefined,
      turu: undefined,
      durum: undefined,
      cinsi: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      page: "0",
    });
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {/* Search */}
      <div className="relative flex-1 sm:min-w-[200px] sm:max-w-[300px]">
        <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Ödeme tanımı ara..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              navigate({ search: searchInput || undefined, page: "0" });
            }
          }}
          onBlur={() => {
            if (searchInput !== search) {
              navigate({ search: searchInput || undefined, page: "0" });
            }
          }}
          className="pl-9"
        />
      </div>

      {/* Tür filter */}
      <Select
        value={turu || "all"}
        onValueChange={(v) =>
          navigate({ turu: v === "all" ? undefined : v, page: "0" })
        }
      >
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="Tüm Türler" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tüm Türler</SelectItem>
          {ODEME_TURLERI.map((t) => (
            <SelectItem key={t} value={t}>
              {ODEME_TURU_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Durum filter */}
      <Select
        value={durum || "all"}
        onValueChange={(v) =>
          navigate({ durum: v === "all" ? undefined : v, page: "0" })
        }
      >
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder="Tüm Durumlar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tüm Durumlar</SelectItem>
          {ODEME_DURUMLARI.map((d) => (
            <SelectItem key={d} value={d}>
              {d === "TAMAMLANDI" ? "Tamamlandı" : "Bekliyor"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Para birimi filter */}
      <Select
        value={cinsi || "all"}
        onValueChange={(v) =>
          navigate({ cinsi: v === "all" ? undefined : v, page: "0" })
        }
      >
        <SelectTrigger className="w-full sm:w-[110px]">
          <SelectValue placeholder="Para Birimi" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tüm</SelectItem>
          {PARA_BIRIMLERI.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date range */}
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) =>
            navigate({ dateFrom: e.target.value || undefined, page: "0" })
          }
          className="w-[140px] text-sm"
        />
        <span className="text-sm text-muted-foreground">—</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) =>
            navigate({ dateTo: e.target.value || undefined, page: "0" })
          }
          className="w-[140px] text-sm"
        />
      </div>

      {/* Clear filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="mr-1 h-4 w-4" />
          Temizle
        </Button>
      )}
    </div>
  );
}

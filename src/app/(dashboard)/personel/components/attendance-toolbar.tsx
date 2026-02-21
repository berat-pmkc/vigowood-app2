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
  ATTENDANCE_DEPARTMENTS,
  ATTENDANCE_DEPARTMENT_LABELS,
} from "@/lib/constants";

interface AttendanceToolbarProps {
  search: string;
  department: string;
  dateFrom: string;
  dateTo: string;
}

export function AttendanceToolbar({
  search,
  department,
  dateFrom,
  dateTo,
}: AttendanceToolbarProps) {
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
      return `/personel?${params.toString()}`;
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

  const hasFilters = search || department || dateFrom || dateTo;

  const clearFilters = () => {
    setSearchInput("");
    navigate({
      search: undefined,
      department: undefined,
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
          placeholder="Çalışan ara..."
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

      {/* Department filter */}
      <Select
        value={department || "all"}
        onValueChange={(v) =>
          navigate({ department: v === "all" ? undefined : v, page: "0" })
        }
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Tüm Departmanlar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tüm Departmanlar</SelectItem>
          {ATTENDANCE_DEPARTMENTS.map((dept) => (
            <SelectItem key={dept} value={dept}>
              {ATTENDANCE_DEPARTMENT_LABELS[dept]}
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
          placeholder="Başlangıç"
        />
        <span className="text-sm text-muted-foreground">—</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) =>
            navigate({ dateTo: e.target.value || undefined, page: "0" })
          }
          className="w-[140px] text-sm"
          placeholder="Bitiş"
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

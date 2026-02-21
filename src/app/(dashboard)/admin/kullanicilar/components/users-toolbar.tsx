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
import { USER_ROLES, USER_STATIONS, USER_STATION_LABELS } from "@/lib/constants";

interface UsersToolbarProps {
  search: string;
  role: string;
  station: string;
  active: string;
  onSearchChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onStationChange: (value: string) => void;
  onActiveChange: (value: string) => void;
}

export function UsersToolbar({
  search,
  role,
  station,
  active,
  onSearchChange,
  onRoleChange,
  onStationChange,
  onActiveChange,
}: UsersToolbarProps) {
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

  const hasFilters = search || role || station || active;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Kullanıcı ID, ad veya e-posta ara..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Role filter */}
      <Select
        value={role || "__all__"}
        onValueChange={(v) => onRoleChange(v === "__all__" ? "" : v)}
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Tüm Roller" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Tüm Roller</SelectItem>
          {USER_ROLES.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Station filter */}
      <Select
        value={station || "__all__"}
        onValueChange={(v) => onStationChange(v === "__all__" ? "" : v)}
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Tüm İstasyonlar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Tüm İstasyonlar</SelectItem>
          {USER_STATIONS.map((s) => (
            <SelectItem key={s} value={s}>
              {USER_STATION_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Active filter */}
      <Select
        value={active || "__all__"}
        onValueChange={(v) => onActiveChange(v === "__all__" ? "" : v)}
      >
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder="Tüm Durumlar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Tüm Durumlar</SelectItem>
          <SelectItem value="true">Aktif</SelectItem>
          <SelectItem value="false">Pasif</SelectItem>
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
            onRoleChange("");
            onStationChange("");
            onActiveChange("");
          }}
        >
          <X className="mr-1 h-4 w-4" />
          Temizle
        </Button>
      )}
    </div>
  );
}

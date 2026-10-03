"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchItems } from "@/lib/kalite/actions";
import type { KaliteItemOption, KaliteItemTipi } from "@/lib/kalite/types";

interface ItemComboboxProps {
  value: KaliteItemOption | null;
  onChange: (item: KaliteItemOption | null) => void;
  /** Sunucudan arama (tüm kalemler). `options` verilirse yok sayılır. */
  tipi?: KaliteItemTipi;
  /** Hazır liste (ör. yalnızca uygunsuz bakiyesi olanlar) — istemcide filtrelenir */
  options?: KaliteItemOption[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
}

function fmt(n: number | null | undefined) {
  return new Intl.NumberFormat("tr-TR").format(Number(n ?? 0));
}

export function ItemCombobox({
  value,
  onChange,
  tipi,
  options,
  placeholder = "Seçiniz...",
  emptyText = "Sonuç bulunamadı.",
  disabled,
}: ItemComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<KaliteItemOption[]>([]);
  const [loading, setLoading] = useState(false);

  const isStatic = !!options;

  useEffect(() => {
    if (isStatic || !open || !tipi) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await searchItems(query, tipi);
      if (cancelled) return;
      if (res.success) setRemote(res.data);
      setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open, tipi, isStatic]);

  const list = isStatic ? options! : remote;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="h-12 w-full justify-between text-left font-normal"
        >
          {value ? (
            <span className="truncate">
              <span className="font-mono font-medium">{value.id}</span>
              {value.adi && <span className="ml-2 text-xs text-muted-foreground">{value.adi}</span>}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[300px] p-0" align="start">
        <Command shouldFilter={isStatic}>
          <CommandInput
            placeholder="Kod veya ad ile ara..."
            value={query}
            onValueChange={setQuery}
            className="h-12"
          />
          <CommandList className="max-h-72">
            {loading && (
              <div className="flex items-center justify-center py-3 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {list.map((it) => (
                <CommandItem
                  key={it.id}
                  value={`${it.id} ${it.adi ?? ""}`}
                  onSelect={() => {
                    onChange(it.id === value?.id ? null : it);
                    setOpen(false);
                  }}
                  className="min-h-11 py-2"
                >
                  <Check className={cn("mr-2 h-4 w-4", value?.id === it.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-sm font-medium">{it.id}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{it.adi}</span>
                    </div>
                    {it.uygunsuz !== undefined ? (
                      <span className="shrink-0 text-xs font-semibold text-[#f28a19]">
                        Uygunsuz: {fmt(it.uygunsuz)}
                      </span>
                    ) : it.stok !== undefined && it.stok !== null ? (
                      <span className="shrink-0 text-xs text-muted-foreground">Stok: {fmt(it.stok)}</span>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { urunAra } from "@/lib/talimat/actions";
import type { UrunStokSecenek } from "@/lib/talimat/types";

interface Props {
  /** Seçili SKU */
  value: string | null;
  /** Seçili ürünün etiketi (liste dışında kalsa bile gösterilir) */
  label?: string | null;
  onChange: (urun: UrunStokSecenek) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  /** Seçilemeyen SKU'lar: sku -> neden (tooltip) */
  disabledSkus?: Record<string, string>;
}

/** Ürün kodu / adı ile sunucuda arama yapan, stok gösteren combobox */
export function UrunStokCombobox({ value, label, onChange, placeholder = "Ürün seç...", disabled, className, compact, disabledSkus }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<UrunStokSecenek[]>([]);
  const [loading, setLoading] = useState(false);
  const reqRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const id = ++reqRef.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await urunAra(q);
      if (id !== reqRef.current) return;
      setItems(r.success ? r.data : []);
      setLoading(false);
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", compact && "h-8 px-2 text-xs", className)}
        >
          {value ? (
            <span className="truncate">{label ? `${value} · ${label}` : value}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,420px)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Kod veya ad ara..." value={q} onValueChange={setQ} />
          <CommandList>
            {loading && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Aranıyor...
              </div>
            )}
            {!loading && items.length === 0 && <CommandEmpty>Ürün bulunamadı</CommandEmpty>}
            <CommandGroup>
              {items.map((u) => {
                const engel = disabledSkus?.[u.sku];
                return (
                  <CommandItem
                    key={u.sku}
                    value={u.sku}
                    disabled={!!engel}
                    title={engel}
                    onSelect={() => {
                      onChange(u);
                      setOpen(false);
                    }}
                    className={cn("flex items-start gap-2", engel && "opacity-50")}
                  >
                    <Check className={cn("mt-0.5 h-4 w-4 shrink-0", value === u.sku ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">
                        <span className="font-medium">{u.sku}</span>
                        {u.urun_adi && <span className="text-muted-foreground"> · {u.urun_adi}</span>}
                      </div>
                      {engel && <div className="text-[11px] text-[#c0424f]">{engel}</div>}
                    </div>
                    <span className="shrink-0 rounded bg-vw-light px-1.5 py-0.5 text-[11px] font-medium text-vw-deep">
                      Stok {u.toplam_stok}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

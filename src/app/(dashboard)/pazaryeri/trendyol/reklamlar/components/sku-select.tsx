"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { updateAdSkuMapping } from "../actions";

interface Product {
  urun_id: string;
  urun_adi: string;
  sku: string;
}

interface Props {
  adName: string;
  selectedIds: string[];
  products: Product[];
}

export function SkuSelect({ adName, selectedIds: initialIds, products }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(initialIds);
  const [saving, setSaving] = useState(false);
  const prevRef = useRef<string>(JSON.stringify(initialIds));

  // Sync with parent when initialIds change
  useEffect(() => {
    const key = JSON.stringify(initialIds);
    if (key !== prevRef.current) {
      prevRef.current = key;
      setSelected(initialIds);
    }
  }, [initialIds]);

  const handleSelect = useCallback(
    async (productId: string) => {
      let newSelected: string[];

      if (selected.includes(productId)) {
        // Remove
        newSelected = selected.filter((id) => id !== productId);
      } else {
        // Add (max 2)
        if (selected.length >= 2) {
          toast.error("Maksimum 2 SKU seçilebilir");
          return;
        }
        newSelected = [...selected, productId];
      }

      setSelected(newSelected);
      setSaving(true);

      const result = await updateAdSkuMapping(adName, newSelected);
      setSaving(false);

      if (!result.success) {
        toast.error(result.error || "SKU kayıt hatası");
        setSelected(selected); // revert
      }
    },
    [adName, selected]
  );

  const handleRemove = useCallback(
    async (productId: string) => {
      const newSelected = selected.filter((id) => id !== productId);
      setSelected(newSelected);
      setSaving(true);

      const result = await updateAdSkuMapping(adName, newSelected);
      setSaving(false);

      if (!result.success) {
        toast.error(result.error || "SKU kayıt hatası");
        setSelected(selected); // revert
      }
    },
    [adName, selected]
  );

  const selectedProducts = selected
    .map((id) => products.find((p) => p.urun_id === id))
    .filter(Boolean) as Product[];

  return (
    <div className="flex items-center gap-1">
      {/* Selected badges */}
      {selectedProducts.map((p) => (
        <Badge
          key={p.urun_id}
          variant="secondary"
          className="max-w-[90px] gap-0.5 truncate text-[10px]"
        >
          <span className="truncate">{p.sku || p.urun_id}</span>
          <button
            onClick={() => handleRemove(p.urun_id)}
            className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
            disabled={saving}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {/* Popover trigger */}
      {selected.length < 2 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs text-muted-foreground"
              disabled={saving}
            >
              <ChevronsUpDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0" align="start">
            <Command>
              <CommandInput placeholder="SKU veya ürün ara..." />
              <CommandList>
                <CommandEmpty>Ürün bulunamadı</CommandEmpty>
                <CommandGroup>
                  {products.map((p) => (
                    <CommandItem
                      key={p.urun_id}
                      value={`${p.sku} ${p.urun_adi}`}
                      onSelect={() => handleSelect(p.urun_id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selected.includes(p.urun_id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="block truncate text-xs font-medium">
                          {p.sku || p.urun_id}
                        </span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {p.urun_adi}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

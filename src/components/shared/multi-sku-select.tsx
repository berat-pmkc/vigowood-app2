"use client";

import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getSkuBadgeStyle } from "@/lib/sku-colors";

interface ProductOption {
  sku: string;
  urun_adi: string | null;
}

interface MultiSkuSelectProps {
  products: ProductOption[];
  selected: string[];
  onChange: (skus: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MultiSkuSelect({
  products,
  selected,
  onChange,
  placeholder = "SKU seçin...",
  disabled = false,
}: MultiSkuSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggleSku = (sku: string) => {
    if (selectedSet.has(sku)) {
      onChange(selected.filter((s) => s !== sku));
    } else {
      onChange([...selected, sku]);
    }
  };

  const removeSku = (sku: string) => {
    onChange(selected.filter((s) => s !== sku));
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between min-h-[36px]"
            disabled={disabled}
          >
            {selected.length > 0 ? (
              <span className="text-sm truncate">
                {selected.length} ürün seçili
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[350px] p-0" align="start">
          <Command>
            <CommandInput placeholder="SKU veya ürün adı ara..." />
            <CommandList>
              <CommandEmpty>Ürün bulunamadı</CommandEmpty>
              <CommandGroup heading="Ürünler">
                {products.map((product) => (
                  <CommandItem
                    key={product.sku}
                    value={`${product.sku} ${product.urun_adi ?? ""}`}
                    onSelect={() => toggleSku(product.sku)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedSet.has(product.sku) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-mono text-xs shrink-0">{product.sku}</span>
                      <span className="truncate text-muted-foreground text-xs">
                        {product.urun_adi ?? "—"}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected SKU badges */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((sku) => {
            const style = getSkuBadgeStyle(sku);
            return (
              <Badge
                key={sku}
                variant="outline"
                className="font-mono text-xs pr-1 gap-1"
                style={{
                  backgroundColor: style.backgroundColor,
                  color: style.color,
                  borderColor: style.borderColor,
                }}
              >
                {sku}
                <button
                  type="button"
                  onClick={() => removeSku(sku)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-black/10"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

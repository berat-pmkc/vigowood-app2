"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ProductSelectorProps {
  products: { sku: string; urun_adi: string | null; kategori: string | null }[];
  selectedSku: string;
  onSelect: (sku: string) => void;
}

export function ProductSelector({
  products,
  selectedSku,
  onSelect,
}: ProductSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedProduct = products.find((p) => p.sku === selectedSku);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between sm:w-[400px]"
        >
          {selectedProduct ? (
            <span className="truncate font-mono">
              {selectedProduct.sku}
            </span>
          ) : (
            <span className="text-muted-foreground">Ürün seçiniz...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="SKU veya ürün adı ile ara..." />
          <CommandList>
            <CommandEmpty>Ürün bulunamadı.</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.sku}
                  value={`${product.sku} ${product.urun_adi ?? ""}`}
                  onSelect={() => {
                    onSelect(product.sku === selectedSku ? "" : product.sku);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedSku === product.sku
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  <span className="font-mono mr-2">
                    {product.sku}
                  </span>
                  <span className="truncate text-muted-foreground text-xs">{product.urun_adi}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

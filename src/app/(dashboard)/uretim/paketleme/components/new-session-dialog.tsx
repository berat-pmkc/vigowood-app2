"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ChevronsUpDown, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getActiveProducts, createPackSession } from "../actions";
import { toast } from "sonner";

interface Product {
  sku: string;
  urun_adi: string | null;
  kategori: string | null;
}

interface NewSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewSessionDialog({ open, onOpenChange }: NewSessionDialogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSku, setSelectedSku] = useState("");
  const [comboOpen, setComboOpen] = useState(false);

  useEffect(() => {
    if (open && products.length === 0) {
      setLoading(true);
      getActiveProducts().then((result) => {
        if (result.success) setProducts(result.data);
        setLoading(false);
      });
    }
    if (!open) {
      setSelectedSku("");
    }
  }, [open, products.length]);

  const selectedProduct = products.find((p) => p.sku === selectedSku);

  const handleSubmit = async () => {
    if (!selectedSku) {
      toast.error("Lütfen bir ürün seçin");
      return;
    }
    setSubmitting(true);
    const result = await createPackSession(selectedSku);
    if (result.success) {
      toast.success("Seans başlatıldı");
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Paketleme Seansı</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium mb-2 block">Ürün Seçin</label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboOpen}
                  className="w-full justify-between h-10"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="text-muted-foreground">Yükleniyor...</span>
                  ) : selectedProduct ? (
                    <span className="truncate">
                      {selectedProduct.urun_adi ?? selectedProduct.sku}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Ürün ara...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Ürün adı veya SKU ara..." />
                  <CommandList>
                    <CommandEmpty>Ürün bulunamadı</CommandEmpty>
                    <CommandGroup>
                      {products.map((product) => (
                        <CommandItem
                          key={product.sku}
                          value={`${product.sku} ${product.urun_adi ?? ""}`}
                          onSelect={() => {
                            setSelectedSku(product.sku);
                            setComboOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedSku === product.sku ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-sm">
                              {product.urun_adi ?? product.sku}
                            </span>
                            <span className="text-xs text-muted-foreground">{product.sku}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Vazgeç
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedSku || submitting}
              className="bg-vw-primary hover:bg-vw-deep text-white"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Seansı Başlat
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

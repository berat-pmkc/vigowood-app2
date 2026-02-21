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
import { ChevronsUpDown, Check, Loader2, TrendingUp, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getActiveProducts, getTopPackagedProducts, createPackSession } from "../actions";
import { toast } from "sonner";

interface Product {
  sku: string;
  urun_adi: string | null;
  kategori: string | null;
}

interface TopProduct {
  sku: string;
  urun_adi: string;
  totalQty: number;
  sessionCount: number;
}

interface NewSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewSessionDialog({ open, onOpenChange }: NewSessionDialogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [topLoading, setTopLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSku, setSelectedSku] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Ürünleri ve popüler ürünleri yükle
  useEffect(() => {
    if (open) {
      // Popüler ürünler
      if (topProducts.length === 0) {
        setTopLoading(true);
        getTopPackagedProducts(10).then((result) => {
          if (result.success) setTopProducts(result.data);
          setTopLoading(false);
        });
      }
      // Tüm ürünler (arama için lazy load)
      if (products.length === 0) {
        setLoading(true);
        getActiveProducts().then((result) => {
          if (result.success) setProducts(result.data);
          setLoading(false);
        });
      }
    }
    if (!open) {
      setSelectedSku("");
      setShowSearch(false);
    }
  }, [open, products.length, topProducts.length]);

  const selectedProduct =
    products.find((p) => p.sku === selectedSku) ??
    topProducts.find((p) => p.sku === selectedSku);

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

  const handleQuickSelect = (sku: string) => {
    setSelectedSku(sku);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle>Yeni Paketleme Seansı</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2 overflow-hidden">
          {/* Popüler Ürünler */}
          {!showSearch && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-vw-primary" />
                <label className="text-sm font-medium">En Çok Paketlenenler</label>
                <span className="text-xs text-muted-foreground">(son 3 ay)</span>
              </div>

              {topLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : topProducts.length > 0 ? (
                <div className="grid grid-cols-1 gap-1.5 max-h-[280px] overflow-y-auto pr-1">
                  {topProducts.map((product, index) => (
                    <button
                      key={product.sku}
                      type="button"
                      onClick={() => handleQuickSelect(product.sku)}
                      className={cn(
                        "flex items-center gap-3 w-full text-left rounded-lg border px-3 py-2 transition-colors",
                        selectedSku === product.sku
                          ? "border-vw-primary bg-vw-primary/10 ring-1 ring-vw-primary/30"
                          : "border-border hover:border-vw-side hover:bg-muted/50"
                      )}
                    >
                      <span
                        className={cn(
                          "flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0",
                          index < 3
                            ? "bg-vw-primary/20 text-vw-deep"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {index + 1}
                      </span>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-medium truncate">
                          {product.urun_adi}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {product.sku} — {product.totalQty} adet / {product.sessionCount} seans
                        </span>
                      </div>
                      {selectedSku === product.sku && (
                        <Check className="h-4 w-4 text-vw-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-3 text-center">
                  Henüz paketleme verisi yok
                </p>
              )}

              {/* Farklı ürün ara butonu */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSearch(true)}
                className="w-full mt-2 text-muted-foreground hover:text-foreground"
              >
                <Search className="h-4 w-4 mr-2" />
                Farklı bir ürün ara...
              </Button>
            </div>
          )}

          {/* Arama modu (combobox) */}
          {showSearch && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Ürün Ara</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSearch(false)}
                  className="h-auto py-0.5 px-2 text-xs text-muted-foreground"
                >
                  Popüler ürünlere dön
                </Button>
              </div>
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
                        {selectedProduct.urun_adi ?? selectedSku}
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
                            className="overflow-hidden"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                selectedSku === product.sku ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col min-w-0 overflow-hidden">
                              <span className="truncate text-sm">
                                {product.urun_adi ?? product.sku}
                              </span>
                              <span className="text-xs text-muted-foreground truncate">{product.sku}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

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

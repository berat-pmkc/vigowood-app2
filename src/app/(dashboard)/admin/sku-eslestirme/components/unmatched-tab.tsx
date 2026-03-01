"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { AlertCircle, Check, Link2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  getUnmatchedProducts,
  getProductsList,
  manualMatch,
  manualMatchFromTrendyol,
  type UnmatchedProduct,
} from "../actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function UnmatchedTab() {
  const [products, setProducts] = useState<UnmatchedProduct[]>([]);
  const [productsList, setProductsList] = useState<{ sku: string; urun_adi: string | null }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Match dialog state
  const [matchTarget, setMatchTarget] = useState<UnmatchedProduct | null>(null);
  const [selectedSku, setSelectedSku] = useState("");
  const [comboOpen, setComboOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [unmatched, prods] = await Promise.all([
        getUnmatchedProducts(),
        getProductsList(),
      ]);
      setProducts(unmatched);
      setProductsList(prods);
    } catch {
      toast.error("Veriler yüklenirken hata oluştu");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fromMappings = products.filter((p) => p.source === "sku_mappings");
  const fromTrendyol = products.filter((p) => p.source === "trendyol_products");

  const handleMatch = useCallback(() => {
    if (!matchTarget || !selectedSku) return;

    startTransition(async () => {
      let result;

      if (matchTarget.source === "sku_mappings") {
        result = await manualMatch(matchTarget.id, selectedSku);
      } else {
        result = await manualMatchFromTrendyol(
          matchTarget.id,
          selectedSku,
          matchTarget.channel_barcode || "",
          matchTarget.channel_sku,
          matchTarget.channel_product_code,
          matchTarget.channel_product_name || ""
        );
      }

      if (result.success) {
        toast.success(`${matchTarget.channel_sku || matchTarget.channel_barcode} → ${selectedSku} eşleştirildi`);
        setMatchTarget(null);
        setSelectedSku("");
        fetchData();
      } else {
        toast.error(result.error);
      }
    });
  }, [matchTarget, selectedSku, fetchData]);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        Yükleniyor...
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Check className="h-12 w-12 text-vw-success mb-3" />
          <p className="text-lg font-medium">Tüm ürünler eşleştirilmiş</p>
          <p className="text-sm text-muted-foreground">
            Eşleştirilmemiş ürün bulunmuyor
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section A: From sku_mappings */}
      {fromMappings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4 text-vw-warning" />
              Eşleştirilmemiş Kayıtlar
            </CardTitle>
            <CardDescription>
              SKU eşleştirme tablosunda kayıtlı ancak henüz bir master SKU ile eşleştirilmemiş ürünler ({fromMappings.length})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {fromMappings.map((item) => (
                <UnmatchedRow
                  key={item.id}
                  item={item}
                  onMatch={() => {
                    setMatchTarget(item);
                    setSelectedSku("");
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section B: From trendyol_products */}
      {fromTrendyol.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4 text-vw-error" />
              Tabloda Olmayan Trendyol Ürünleri
            </CardTitle>
            <CardDescription>
              Trendyol&apos;da mevcut ancak SKU eşleştirme tablosunda hiç kaydı olmayan ürünler ({fromTrendyol.length})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {fromTrendyol.map((item) => (
                <UnmatchedRow
                  key={item.id}
                  item={item}
                  onMatch={() => {
                    setMatchTarget(item);
                    setSelectedSku("");
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Match Dialog */}
      <Dialog
        open={!!matchTarget}
        onOpenChange={(open) => {
          if (!open) {
            setMatchTarget(null);
            setSelectedSku("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ürün Eşleştir</DialogTitle>
            <DialogDescription>
              {matchTarget?.channel_product_name && (
                <span className="block mt-1 font-medium text-foreground">
                  {matchTarget.channel_product_name}
                </span>
              )}
              {matchTarget?.channel_sku && (
                <span className="block mt-0.5 font-mono text-xs">
                  SKU: {matchTarget.channel_sku}
                </span>
              )}
              {matchTarget?.channel_barcode && (
                <span className="block mt-0.5 font-mono text-xs">
                  Barkod: {matchTarget.channel_barcode}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              Master SKU Seçin
            </label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboOpen}
                  className="w-full justify-between"
                >
                  {selectedSku
                    ? productsList.find((p) => p.sku === selectedSku)
                      ? `${selectedSku} — ${productsList.find((p) => p.sku === selectedSku)?.urun_adi || ""}`
                      : selectedSku
                    : "Ürün ara..."}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="SKU veya ürün adı ara..." />
                  <CommandList>
                    <CommandEmpty>Ürün bulunamadı</CommandEmpty>
                    <CommandGroup>
                      {productsList.map((p) => (
                        <CommandItem
                          key={p.sku}
                          value={`${p.sku} ${p.urun_adi || ""}`}
                          onSelect={() => {
                            setSelectedSku(p.sku);
                            setComboOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedSku === p.sku ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="font-mono text-sm mr-2">{p.sku}</span>
                          <span className="text-muted-foreground text-sm truncate">
                            {p.urun_adi || ""}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMatchTarget(null);
                setSelectedSku("");
              }}
            >
              İptal
            </Button>
            <Button
              onClick={handleMatch}
              disabled={!selectedSku || isPending}
            >
              {isPending ? "Eşleştiriliyor..." : "Eşleştir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UnmatchedRow({
  item,
  onMatch,
}: {
  item: UnmatchedProduct;
  onMatch: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50">
      <div className="flex items-center gap-3 min-w-0">
        <Badge
          variant="outline"
          className={
            item.channel === "trendyol"
              ? "bg-orange-100 text-orange-700 border-orange-200 shrink-0"
              : "bg-blue-100 text-blue-700 border-blue-200 shrink-0"
          }
        >
          {item.channel === "trendyol" ? "TY" : "İkas"}
        </Badge>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {item.channel_sku && (
              <span className="font-mono text-sm font-medium">{item.channel_sku}</span>
            )}
            {item.channel_barcode && (
              <span className="font-mono text-xs text-muted-foreground">
                {item.channel_barcode}
              </span>
            )}
          </div>
          {item.channel_product_name && (
            <p className="text-sm text-muted-foreground truncate max-w-[400px]">
              {item.channel_product_name}
            </p>
          )}
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onMatch} className="shrink-0 ml-2">
        <Link2 className="mr-1 h-3.5 w-3.5" />
        Eşleştir
      </Button>
    </div>
  );
}

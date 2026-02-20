"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { getActiveProducts, createPackSession } from "../actions";
import { cn } from "@/lib/utils";
import {
  ChevronsUpDown,
  Check,
  Package,
  Send,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface Product {
  sku: string;
  urun_adi: string | null;
  kategori: string | null;
}

export function YeniPaketlemeForm() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selectedSku, setSelectedSku] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getActiveProducts().then((res) => {
      if (res.success) setProducts(res.data);
      setProductsLoading(false);
    });
  }, []);

  const selectedProduct = products.find((p) => p.sku === selectedSku);

  const handleSubmit = async () => {
    if (!selectedSku) {
      toast.error("Ürün seçimi gereklidir");
      return;
    }
    if (qty < 1) {
      toast.error("Adet en az 1 olmalıdır");
      return;
    }

    setSubmitting(true);
    const result = await createPackSession({
      sku: selectedSku,
      qty,
      not_text: notes.trim() || null,
    });

    if (!result.success) {
      toast.error(result.error);
      setSubmitting(false);
      return;
    }

    toast.success("Paketleme seansı oluşturuldu");
    router.push("/uretim/paketleme");
  };

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5" />
            Yeni Paketleme Seansı
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* SKU seçimi */}
          <div>
            <Label>Ürün</Label>
            {productsLoading ? (
              <Skeleton className="h-12 w-full mt-1" />
            ) : products.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-1">
                Aktif ürün bulunamadı.
              </p>
            ) : (
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    className="w-full justify-between h-12 text-left mt-1"
                  >
                    {selectedProduct
                      ? `${selectedProduct.urun_adi ?? selectedProduct.sku}`
                      : "Ürün seçin..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Ürün ara..." />
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
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {product.urun_adi ?? product.sku}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {product.sku}
                                {product.kategori && ` • ${product.kategori}`}
                              </p>
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

          {/* Seçili ürün bilgisi */}
          {selectedProduct && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium">{selectedProduct.urun_adi}</p>
              <p className="text-muted-foreground">{selectedProduct.sku}</p>
              {selectedProduct.kategori && (
                <Badge variant="outline" className="mt-1">{selectedProduct.kategori}</Badge>
              )}
            </div>
          )}

          {/* Adet */}
          <div>
            <Label htmlFor="qty">Paketleme Adedi</Label>
            <Input
              id="qty"
              type="number"
              min={1}
              max={500}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
              className="mt-1 w-32"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Tamamlandığında bu miktar mamül stoğa eklenecek.
            </p>
          </div>

          {/* Not */}
          <div>
            <Label htmlFor="notes">Not (isteğe bağlı)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Paketleme notu..."
              className="mt-1"
              maxLength={500}
            />
          </div>

          {/* Submit */}
          <Button
            className="w-full h-14 text-base"
            onClick={handleSubmit}
            disabled={!selectedSku || qty < 1 || submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Oluşturuluyor...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Seans Oluştur
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

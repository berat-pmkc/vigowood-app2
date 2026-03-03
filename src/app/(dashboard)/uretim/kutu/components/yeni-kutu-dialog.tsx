"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { AdetInput } from "@/components/shared/adet-input";
import { cn } from "@/lib/utils";
import { createKutuSession, getKartonSablonlarForSku, getTopKutuSkus, getKutuOperators } from "../actions";
import {
  ArrowLeft,
  Check,
  Search,
  Box,
  User,
  Loader2,
  Play,
} from "lucide-react";
import { toast } from "sonner";

interface YeniKutuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface KartonSablon {
  plaka_id: string;
  tur: string | null;
  en: number | null;
  boy: number | null;
  kutu_sure_dk: number | null;
  part_id: string | null;
  part_adi: string | null;
  part_stok: number;
  part_kritik: number;
}

interface TopSku {
  sku: string;
  count: number;
  urun_adi: string;
}

interface ProductOption {
  sku: string;
  urun_adi: string;
}

interface Operator {
  user_id: string;
  full_name: string;
  station: string;
}

export function YeniKutuDialog({ open, onOpenChange }: YeniKutuDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [isPending, startTransition] = useTransition();

  // Step 1 state
  const [selectedSku, setSelectedSku] = useState("");
  const [selectedSkuLabel, setSelectedSkuLabel] = useState("");
  const [topSkus, setTopSkus] = useState<TopSku[]>([]);
  const [sablonlar, setSablonlar] = useState<KartonSablon[]>([]);
  const [selectedSablon, setSelectedSablon] = useState<KartonSablon | null>(null);
  const [loadingSablonlar, setLoadingSablonlar] = useState(false);

  // Step 2 state
  const [qty, setQty] = useState(10);
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [notText, setNotText] = useState("");

  // Search
  const [skuSearch, setSkuSearch] = useState("");
  const [allProducts, setAllProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    if (open) {
      // Reset
      setStep(1);
      setSelectedSku("");
      setSelectedSkuLabel("");
      setSelectedSablon(null);
      setSablonlar([]);
      setQty(10);
      setSelectedOperator(null);
      setNotText("");
      setSkuSearch("");

      // Load top SKUs + operators + products
      setProductsLoading(true);
      Promise.all([
        getTopKutuSkus(10),
        getKutuOperators(),
      ]).then(([topRes, opRes]) => {
        if (topRes.success) setTopSkus(topRes.data);
        if (opRes.success) setOperators(opRes.data);
      });

      // Load all products for search
      import("@/lib/supabase/client").then(async ({ createClient }) => {
        const supabase = createClient();
        const { data } = await supabase
          .from("products")
          .select("sku, urun_adi")
          .eq("aktif_mi", true)
          .order("sku");
        if (data) setAllProducts(data as ProductOption[]);
        setProductsLoading(false);
      });
    }
  }, [open]);

  // Load sablonlar when SKU changes
  useEffect(() => {
    if (!selectedSku) {
      setSablonlar([]);
      setSelectedSablon(null);
      return;
    }

    setLoadingSablonlar(true);
    setSelectedSablon(null);

    getKartonSablonlarForSku(selectedSku).then((r) => {
      if (r.success) {
        setSablonlar(r.data);
        // Auto-select if single sablon
        if (r.data.length === 1) {
          setSelectedSablon(r.data[0]);
        }
      }
      setLoadingSablonlar(false);
    });
  }, [selectedSku]);

  // Auto advance to step 2 when both selected
  useEffect(() => {
    if (selectedSku && selectedSablon && step === 1) {
      setStep(2);
    }
  }, [selectedSku, selectedSablon, step]);

  const handleSkuSelect = useCallback((sku: string, label: string) => {
    setSelectedSku(sku);
    setSelectedSkuLabel(label);
    setSelectedSablon(null);
    setSkuSearch("");
  }, []);

  const handleSubmit = () => {
    if (!selectedSku || !selectedSablon || !selectedSablon.part_id) return;

    startTransition(async () => {
      const result = await createKutuSession({
        plaka_id: selectedSablon.plaka_id,
        sku: selectedSku,
        part_id: selectedSablon.part_id!,
        qty,
        not_text: notText || null,
        operator_id: selectedOperator?.user_id,
        operator_name: selectedOperator?.full_name,
      });

      if (result.success) {
        toast.success("Kutu üretimi başlatıldı");
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  const filteredProducts = skuSearch
    ? allProducts.filter(
        (p) =>
          p.sku.toLowerCase().includes(skuSearch.toLowerCase()) ||
          (p.urun_adi ?? "").toLowerCase().includes(skuSearch.toLowerCase())
      )
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            {step === 2 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setStep(1)}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <Box className="w-5 h-5" />
            {step === 1 ? "Yeni Kutu Üretimi — Seçimler" : "Yeni Kutu Üretimi — Detaylar"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {step === 1 && (
            <>
              {/* 1. Ürün Seçimi */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  1. Ürün
                  {selectedSku && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {selectedSku}
                      <button
                        type="button"
                        className="ml-1 hover:text-destructive"
                        onClick={() => {
                          setSelectedSku("");
                          setSelectedSkuLabel("");
                          setSelectedSablon(null);
                        }}
                      >
                        ×
                      </button>
                    </Badge>
                  )}
                </h3>

                {!selectedSku && (
                  <>
                    {/* Search input */}
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="SKU veya ürün adı ara..."
                        className="pl-9"
                        value={skuSearch}
                        onChange={(e) => setSkuSearch(e.target.value)}
                      />
                    </div>

                    {/* Search results */}
                    {skuSearch && filteredProducts.length > 0 && (
                      <div className="max-h-40 overflow-y-auto border rounded-lg mb-3">
                        {filteredProducts.slice(0, 20).map((p) => (
                          <button
                            key={p.sku}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm border-b last:border-b-0"
                            onClick={() => handleSkuSelect(p.sku, p.urun_adi ?? p.sku)}
                          >
                            <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                            <span className="ml-2">{p.urun_adi}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {skuSearch && filteredProducts.length === 0 && !productsLoading && (
                      <p className="text-sm text-muted-foreground mb-3">Sonuç bulunamadı</p>
                    )}

                    {/* Top SKUs quick cards (Kesim pattern) */}
                    {!skuSearch && topSkus.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1.5">En çok üretilen:</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {topSkus.map((s) => (
                            <button
                              key={s.sku}
                              type="button"
                              className="text-left px-2.5 py-2 rounded-md border hover:bg-muted/50 transition-colors"
                              onClick={() => handleSkuSelect(s.sku, s.urun_adi)}
                            >
                              <p className="text-xs font-medium truncate">{s.urun_adi}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{s.sku}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {productsLoading && (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 2. Karton Şablon Seçimi */}
              {selectedSku && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">2. Karton Şablon</h3>

                  {loadingSablonlar ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                    </div>
                  ) : sablonlar.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      <Box className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Bu SKU için karton şablon bulunamadı.
                      <br />
                      <span className="text-xs">Admin panelinden şablon ekleyin.</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {sablonlar.map((s) => {
                        const isSelected = selectedSablon?.plaka_id === s.plaka_id;
                        const isLowStock = s.part_stok < s.part_kritik;
                        const dimensions = s.en && s.boy ? `${s.en}×${s.boy} cm` : null;
                        return (
                          <Card
                            key={s.plaka_id}
                            className={cn(
                              "p-3 cursor-pointer transition-all",
                              isSelected
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "hover:border-muted-foreground/30"
                            )}
                            onClick={() => setSelectedSablon(s)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {s.plaka_id}
                                  {s.part_adi && <span className="text-muted-foreground font-normal ml-1.5">— {s.part_adi}</span>}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  {s.tur && (
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[10px]",
                                        s.tur === "İç Kutu"
                                          ? "bg-blue-50 text-blue-700 border-blue-200"
                                          : "bg-orange-50 text-orange-700 border-orange-200"
                                      )}
                                    >
                                      {s.tur}
                                    </Badge>
                                  )}
                                  {dimensions && (
                                    <Badge variant="outline" className="text-[10px]">{dimensions}</Badge>
                                  )}
                                  {s.kutu_sure_dk != null && (
                                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700">
                                      {s.kutu_sure_dk} dk
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 ml-3">
                                {s.part_adi && (
                                  <div className="text-right">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[10px]",
                                        isLowStock ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      )}
                                    >
                                      Stok: {s.part_stok}
                                    </Badge>
                                  </div>
                                )}

                                {isSelected && (
                                  <Check className="w-5 h-5 text-primary" />
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              {/* Özet badges */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ürün:</span>
                  <span className="font-medium">{selectedSkuLabel || selectedSku}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Şablon:</span>
                  <span className="font-medium truncate ml-4">{selectedSablon?.plaka_id}</span>
                </div>
                {selectedSablon?.tur && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tür:</span>
                    <span className="font-medium truncate ml-4">{selectedSablon.tur}</span>
                  </div>
                )}
                {selectedSablon?.part_adi && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Karton Tip:</span>
                    <span className="font-medium truncate ml-4">{selectedSablon.part_adi}</span>
                  </div>
                )}
              </div>

              {/* Adet */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Adet</h3>
                <AdetInput
                  value={qty}
                  onChange={setQty}
                  min={1}
                  max={1000}
                  quickValues={[1, 5, 10, 15, 20]}
                />
              </div>

              {/* Operatör */}
              {operators.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Operatör</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {operators.map((op) => (
                      <button
                        key={op.user_id}
                        type="button"
                        className={cn(
                          "flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all text-left",
                          selectedOperator?.user_id === op.user_id
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:border-primary/30"
                        )}
                        onClick={() => setSelectedOperator(
                          selectedOperator?.user_id === op.user_id ? null : op
                        )}
                      >
                        <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium truncate">{op.full_name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Not */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Not (opsiyonel)</h3>
                <Textarea
                  value={notText}
                  onChange={(e) => setNotText(e.target.value)}
                  placeholder="Ek bilgi..."
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* Kaydet */}
              <Button
                className="w-full h-14 text-base"
                onClick={handleSubmit}
                disabled={isPending || !selectedSku || !selectedSablon?.part_id}
              >
                {isPending ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Play className="w-5 h-5 mr-2" />
                )}
                Üretime Başlat
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

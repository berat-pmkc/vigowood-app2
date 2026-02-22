"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronsUpDown, Check, Loader2, Search, ArrowRight, ArrowLeft, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getActiveProductsWithSteps,
  getTopMontajProducts,
  getStepsForProduct,
  getMontajOperators,
  createMontajSession,
} from "../actions";
import { toast } from "sonner";
import { getSkuBadgeStyle } from "@/lib/sku-colors";

interface Operator {
  user_id: string;
  full_name: string;
  role: string;
}

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

interface StepInfo {
  step_id: string;
  sku: string | null;
  step_name: string | null;
  seq_no: number | null;
  is_final_step: boolean | null;
  bom_count: number;
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

  // Step 2 state
  const [activeStep, setActiveStep] = useState<1 | 2>(1);
  const [steps, setSteps] = useState<StepInfo[]>([]);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState("");
  // Cache: SKU → steps (prefetch)
  const [stepsCache, setStepsCache] = useState<Map<string, StepInfo[]>>(new Map());
  // Workers
  const [operators, setOperators] = useState<Operator[]>([]);
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());

  // Ürünleri, popüler ürünleri ve operatörleri yükle
  useEffect(() => {
    if (open) {
      if (topProducts.length === 0) {
        setTopLoading(true);
        getTopMontajProducts(10).then((result) => {
          if (result.success) setTopProducts(result.data);
          setTopLoading(false);
        });
      }
      if (products.length === 0) {
        setLoading(true);
        getActiveProductsWithSteps().then((result) => {
          if (result.success) setProducts(result.data);
          setLoading(false);
        });
      }
      if (operators.length === 0) {
        getMontajOperators().then((result) => {
          if (result.success) setOperators(result.data);
        });
      }
    }
    if (!open) {
      setSelectedSku("");
      setSelectedStepId("");
      setActiveStep(1);
      setSteps([]);
      setSelectedWorkers(new Set());
    }
  }, [open, products.length, topProducts.length, operators.length]);

  // Adımları yükle — SKU seçilir seçilmez prefetch (Step 2'ye geçmeden)
  useEffect(() => {
    if (selectedSku) {
      // Cache'de varsa hemen yükle
      const cached = stepsCache.get(selectedSku);
      if (cached) {
        setSteps(cached);
        return;
      }
      setStepsLoading(true);
      setSelectedStepId("");
      getStepsForProduct(selectedSku).then((result) => {
        if (result.success) {
          setSteps(result.data);
          setStepsCache((prev) => new Map(prev).set(selectedSku, result.data));
        }
        setStepsLoading(false);
      });
    }
  }, [selectedSku, stepsCache]);

  const selectedProduct =
    products.find((p) => p.sku === selectedSku) ??
    topProducts.find((p) => p.sku === selectedSku);

  const handleNext = () => {
    if (!selectedSku) {
      toast.error("Lütfen bir ürün seçin");
      return;
    }
    setActiveStep(2);
  };

  const toggleWorker = (id: string) => {
    setSelectedWorkers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!selectedSku || !selectedStepId) {
      toast.error("Ürün ve adım seçimi gereklidir");
      return;
    }
    if (selectedWorkers.size === 0) {
      toast.error("En az 1 çalışan seçiniz");
      return;
    }
    const workers = Array.from(selectedWorkers).map((id) => {
      const op = operators.find((o) => o.user_id === id);
      return { id, name: op?.full_name ?? id };
    });

    setSubmitting(true);
    const result = await createMontajSession(selectedSku, selectedStepId, workers);
    if (result.success) {
      toast.success("Montaj seansı başlatıldı");
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {activeStep === 1 ? "Yeni Montaj Seansı — Ürün Seçimi" : "Yeni Montaj Seansı — Adım Seçimi"}
          </DialogTitle>
        </DialogHeader>

        {activeStep === 1 ? (
          /* ─── Adım 1: Ürün Seçimi ─── */
          <div className="space-y-4 pt-2 overflow-y-auto flex-1">
            {/* Ürün Arama */}
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboOpen}
                  className={cn(
                    "w-full justify-between h-11 text-base",
                    selectedSku
                      ? "border-vw-primary ring-1 ring-vw-primary/30"
                      : "border-vw-side"
                  )}
                  disabled={loading}
                >
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {loading ? (
                      <span className="text-muted-foreground">Yükleniyor...</span>
                    ) : selectedProduct ? (
                      <span className="truncate font-medium">{selectedSku}</span>
                    ) : (
                      <span className="text-muted-foreground">Ürün kodu ara...</span>
                    )}
                  </div>
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
                            <span className="truncate text-sm font-medium">{product.sku}</span>
                            <span className="text-xs text-muted-foreground truncate">
                              {product.urun_adi ?? ""}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Hızlı Seçim */}
            {topLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : topProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-1.5">
                {topProducts.map((product) => (
                  <button
                    key={product.sku}
                    type="button"
                    onClick={() => setSelectedSku(product.sku)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-xs font-medium text-center transition-colors truncate",
                      selectedSku === product.sku
                        ? "border-vw-primary bg-vw-primary/10 text-vw-deep ring-1 ring-vw-primary/30"
                        : "border-border text-foreground hover:border-vw-side hover:bg-muted/50"
                    )}
                  >
                    {product.sku}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Vazgeç
              </Button>
              <Button
                onClick={handleNext}
                disabled={!selectedSku}
                className="bg-vw-primary hover:bg-vw-deep text-white"
              >
                Devam
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        ) : (
          /* ─── Adım 2: Adım Seçimi ─── */
          <div className="space-y-4 pt-2 overflow-y-auto flex-1">
            {/* Seçilen ürün */}
            {(() => {
              const skuStyle = getSkuBadgeStyle(selectedSku);
              return (
                <div className="rounded-lg p-3 flex items-center gap-3" style={{ backgroundColor: skuStyle.backgroundColor }}>
                  <span className="font-bold text-sm" style={{ color: skuStyle.color }}>{selectedSku}</span>
                  <span className="text-xs text-muted-foreground truncate">{selectedProduct?.urun_adi ?? ""}</span>
                </div>
              );
            })()}

            {/* Adım listesi */}
            {stepsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Adımlar yükleniyor...
              </div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {steps.map((step) => (
                  <button
                    key={step.step_id}
                    type="button"
                    onClick={() => setSelectedStepId(step.step_id)}
                    className={cn(
                      "w-full text-left rounded-lg border p-3 transition-colors",
                      selectedStepId === step.step_id
                        ? "border-vw-primary bg-vw-primary/10 ring-1 ring-vw-primary/30"
                        : "border-border hover:border-vw-side hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground w-6">
                          {step.seq_no}
                        </span>
                        <span className="text-sm font-medium truncate">
                          {step.step_name || step.step_id}
                        </span>
                      </div>
                      {step.is_final_step && (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                          Son
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
                {steps.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Bu ürüne ait montaj adımı bulunamadı
                  </p>
                )}
              </div>
            )}

            {/* Çalışan seçimi */}
            {selectedStepId && (
              <div>
                <p className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4" />
                  Çalışanlar ({selectedWorkers.size} kişi)
                </p>
                <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-0.5">
                  {operators.map((op) => (
                    <label
                      key={op.user_id}
                      className="flex items-center gap-3 p-1.5 rounded-md hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedWorkers.has(op.user_id)}
                        onCheckedChange={() => toggleWorker(op.user_id)}
                      />
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm truncate">{op.full_name}</span>
                        <span className="text-[10px] text-muted-foreground">{op.user_id}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setActiveStep(1);
                  setSelectedStepId("");
                }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Geri
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!selectedStepId || selectedWorkers.size === 0 || submitting}
                className="bg-vw-primary hover:bg-vw-deep text-white"
              >
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Seansı Başlat
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

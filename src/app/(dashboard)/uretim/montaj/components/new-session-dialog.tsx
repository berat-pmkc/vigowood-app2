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
import { ChevronsUpDown, Check, Loader2, Search, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getActiveProductsWithSteps,
  getTopMontajProducts,
  getStepsForProduct,
  getStepBomWithStock,
  createMontajSession,
} from "../actions";
import { MaterialCheckPanel, type BomItemWithStock } from "./material-check-panel";
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
  const [bomItems, setBomItems] = useState<BomItemWithStock[]>([]);
  const [bomLoading, setBomLoading] = useState(false);

  // Ürünleri ve popüler ürünleri yükle
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
    }
    if (!open) {
      setSelectedSku("");
      setSelectedStepId("");
      setActiveStep(1);
      setSteps([]);
      setBomItems([]);
    }
  }, [open, products.length, topProducts.length]);

  // Adımları yükle (SKU seçildiğinde)
  useEffect(() => {
    if (selectedSku && activeStep === 2) {
      setStepsLoading(true);
      setSelectedStepId("");
      setBomItems([]);
      getStepsForProduct(selectedSku).then((result) => {
        if (result.success) setSteps(result.data);
        setStepsLoading(false);
      });
    }
  }, [selectedSku, activeStep]);

  // BOM yükle (step seçildiğinde)
  useEffect(() => {
    if (selectedStepId) {
      setBomLoading(true);
      getStepBomWithStock(selectedStepId).then((result) => {
        if (result.success) setBomItems(result.data);
        setBomLoading(false);
      });
    } else {
      setBomItems([]);
    }
  }, [selectedStepId]);

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

  const handleSubmit = async () => {
    if (!selectedSku || !selectedStepId) {
      toast.error("Ürün ve adım seçimi gereklidir");
      return;
    }
    setSubmitting(true);
    const result = await createMontajSession(selectedSku, selectedStepId);
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
              <div className="grid grid-cols-2 gap-2">
                {topProducts.map((product) => (
                  <button
                    key={product.sku}
                    type="button"
                    onClick={() => setSelectedSku(product.sku)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-sm font-medium text-center transition-colors truncate",
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
          /* ─── Adım 2: Adım Seçimi + BOM ─── */
          <div className="space-y-4 pt-2 overflow-y-auto flex-1">
            {/* Seçilen ürün */}
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="font-medium text-sm">{selectedProduct?.urun_adi ?? selectedSku}</p>
              <p className="text-xs text-muted-foreground">{selectedSku}</p>
            </div>

            {/* Adım listesi */}
            {stepsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Adımlar yükleniyor...
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
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
                      <div className="flex items-center gap-1.5">
                        {step.bom_count > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {step.bom_count} malzeme
                          </Badge>
                        )}
                        {step.is_final_step && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                            Son
                          </Badge>
                        )}
                      </div>
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

            {/* BOM / Malzeme durumu */}
            {selectedStepId && (
              <div>
                <p className="text-sm font-medium mb-2">Malzeme Durumu</p>
                {bomLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Yükleniyor...
                  </div>
                ) : (
                  <MaterialCheckPanel items={bomItems} />
                )}
              </div>
            )}

            <div className="flex justify-between gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setActiveStep(1);
                  setSelectedStepId("");
                  setBomItems([]);
                }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Geri
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!selectedStepId || submitting}
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

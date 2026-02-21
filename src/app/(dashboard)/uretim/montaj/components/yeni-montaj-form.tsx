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
import { MaterialCheckPanel, type BomItemWithStock } from "./material-check-panel";
import {
  getActiveProductsWithSteps,
  getProductAssemblyData,
  createMontajBatch,
} from "../actions";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Check,
  Package,
  ClipboardList,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

interface Product {
  sku: string;
  urun_adi: string | null;
  kategori: string | null;
}

interface StepWithBom {
  step_id: string;
  step_name: string | null;
  seq_no: number | null;
  bom_count: number;
}

export function YeniMontajForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1: SKU seçimi
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selectedSku, setSelectedSku] = useState("");
  const [comboOpen, setComboOpen] = useState(false);

  // Step 2: Malzeme kontrolü
  const [assemblySteps, setAssemblySteps] = useState<StepWithBom[]>([]);
  const [bomItems, setBomItems] = useState<BomItemWithStock[]>([]);
  const [materialLoading, setMaterialLoading] = useState(false);
  const [adet, setAdet] = useState(1);

  // Step 3: Onay
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load products on mount
  useEffect(() => {
    getActiveProductsWithSteps().then((res) => {
      if (res.success) setProducts(res.data);
      setProductsLoading(false);
    });
  }, []);

  const selectedProduct = products.find((p) => p.sku === selectedSku);

  // Load assembly data when SKU changes or adet changes
  const loadAssemblyData = async (sku: string, qty: number) => {
    setMaterialLoading(true);
    const res = await getProductAssemblyData(sku, qty);
    if (res.success) {
      setAssemblySteps(res.data.steps);
      setBomItems(res.data.bomItems);
    }
    setMaterialLoading(false);
  };

  const handleSkuSelect = async (sku: string) => {
    setSelectedSku(sku);
    setComboOpen(false);
  };

  const goToStep2 = async () => {
    if (!selectedSku) return;
    await loadAssemblyData(selectedSku, adet);
    setStep(2);
  };

  const handleAdetChange = async (newAdet: number) => {
    const clamped = Math.max(1, Math.min(50, newAdet));
    setAdet(clamped);
    if (selectedSku) {
      await loadAssemblyData(selectedSku, clamped);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const result = await createMontajBatch({
      sku: selectedSku,
      adet,
      notes: notes.trim() || null,
    });

    if (!result.success) {
      toast.error(result.error);
      setSubmitting(false);
      return;
    }

    toast.success("Montaj oluşturuldu");
    router.push("/uretim/montaj");
  };

  const allSufficient = bomItems
    .filter((b) => !b.is_asm_reference)
    .every((b) => b.is_sufficient);

  const insufficientCount = bomItems
    .filter((b) => !b.is_asm_reference && !b.is_sufficient)
    .length;

  // Step indicators
  const stepLabels = ["Ürün Seç", "Malzeme Kontrolü", "Oluştur"];
  const stepIcons = [Package, ClipboardList, Send];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicators */}
      <div className="flex items-center justify-center mb-6">
        {stepLabels.map((label, i) => {
          const StepIcon = stepIcons[i];
          const stepNum = i + 1;
          const isActive = step === stepNum;
          const isCompleted = step > stepNum;

          return (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                    isActive && "bg-primary text-primary-foreground",
                    isCompleted && "bg-emerald-500 text-white",
                    !isActive && !isCompleted && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                </div>
                <span className={cn(
                  "text-xs mt-1 font-medium",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}>
                  {label}
                </span>
              </div>
              {i < stepLabels.length - 1 && (
                <div className={cn(
                  "w-12 sm:w-20 h-0.5 mx-2 mb-5",
                  step > stepNum ? "bg-emerald-500" : "bg-muted"
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: SKU Seçimi */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ürün Seçin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {productsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Montaj adımı tanımlanmış aktif ürün bulunamadı.
              </p>
            ) : (
              <>
                <Popover open={comboOpen} onOpenChange={setComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboOpen}
                      className="w-full justify-between h-12 text-left"
                    >
                      {selectedProduct
                        ? selectedProduct.sku
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
                              onSelect={() => handleSkuSelect(product.sku)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedSku === product.sku ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium font-mono truncate">
                                  {product.sku}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {product.urun_adi}
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

                {selectedProduct && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <p className="font-medium font-mono">{selectedProduct.sku}</p>
                    <p className="text-muted-foreground">{selectedProduct.urun_adi}</p>
                    {selectedProduct.kategori && (
                      <Badge variant="outline" className="mt-1">{selectedProduct.kategori}</Badge>
                    )}
                  </div>
                )}

                <Button
                  className="w-full h-12"
                  onClick={goToStep2}
                  disabled={!selectedSku}
                >
                  Devam
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Malzeme Kontrolü */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Malzeme Kontrolü</CardTitle>
            <p className="text-sm text-muted-foreground">
              {selectedSku} — {assemblySteps.length} adım
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Adet seçimi */}
            <div>
              <Label htmlFor="adet">Üretim Adedi</Label>
              <Input
                id="adet"
                type="number"
                min={1}
                max={50}
                value={adet}
                onChange={(e) => handleAdetChange(parseInt(e.target.value) || 1)}
                className="mt-1 w-32"
              />
            </div>

            {materialLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <>
                {/* Özet */}
                <div className="flex items-center gap-2">
                  {allSufficient ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Tüm malzemeler yeterli
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700 border-red-200">
                      <XCircle className="w-3 h-3 mr-1" />
                      {insufficientCount} malzeme yetersiz
                    </Badge>
                  )}
                </div>

                {/* Adım bazlı BOM */}
                {assemblySteps.map((as) => {
                  const stepBom = bomItems.filter((b) => b.step_id === as.step_id);
                  if (stepBom.length === 0) return null;

                  return (
                    <div key={as.step_id}>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                          {as.seq_no}
                        </span>
                        {as.step_name ?? as.step_id}
                      </h4>
                      <MaterialCheckPanel items={stepBom} />
                    </div>
                  );
                })}
              </>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-12">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Geri
              </Button>
              <Button
                className="flex-1 h-12"
                onClick={() => setStep(3)}
                disabled={materialLoading}
              >
                Devam
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Onay */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Onay ve Oluştur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Özet */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ürün</span>
                <span className="font-medium font-mono">{selectedSku}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SKU</span>
                <span className="font-mono text-xs">{selectedSku}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Adet</span>
                <span className="font-bold text-lg">{adet}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Toplam Adım</span>
                <span className="font-medium">{assemblySteps.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Malzeme Durumu</span>
                {allSufficient ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    Yeterli
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    {insufficientCount} eksik
                  </Badge>
                )}
              </div>
            </div>

            {/* Not */}
            <div>
              <Label htmlFor="notes">Not (isteğe bağlı)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Montaj notu..."
                className="mt-1"
                maxLength={500}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1 h-12">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Geri
              </Button>
              <Button
                className="flex-1 h-14 text-base"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Oluşturuluyor...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Montaj Oluştur
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
import { AdetInput } from "@/components/shared/adet-input";
import { cn } from "@/lib/utils";
import { createKutuSession, getKartonSablonlarForSku, getTopKutuSkus, getKutuOperators } from "../actions";
import {
  ArrowLeft,
  Check,
  ChevronsUpDown,
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
  plaka_adi: string;
  tipi: string | null;
  renk: string | null;
  kutu_sure_dk: number | null;
  part_id: string | null;
  part_adi: string | null;
  part_stok: number;
  part_kritik: number;
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
  const [skuOpen, setSkuOpen] = useState(false);
  const [selectedSku, setSelectedSku] = useState("");
  const [topSkus, setTopSkus] = useState<string[]>([]);
  const [sablonlar, setSablonlar] = useState<KartonSablon[]>([]);
  const [selectedSablon, setSelectedSablon] = useState<KartonSablon | null>(null);
  const [loadingSablonlar, setLoadingSablonlar] = useState(false);

  // Step 2 state
  const [qty, setQty] = useState(10);
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [notText, setNotText] = useState("");

  // All products for SKU search
  const [allProducts, setAllProducts] = useState<{ sku: string; urun_adi: string }[]>([]);

  // Load initial data
  useEffect(() => {
    if (open) {
      // Reset
      setStep(1);
      setSelectedSku("");
      setSelectedSablon(null);
      setSablonlar([]);
      setQty(10);
      setSelectedOperator(null);
      setNotText("");

      // Load top SKUs
      getTopKutuSkus(10).then((r) => {
        if (r.success) setTopSkus(r.data);
      });

      // Load operators
      getKutuOperators().then((r) => {
        if (r.success) setOperators(r.data);
      });
    }
  }, [open]);

  // Load products for combobox (lazy on first open)
  useEffect(() => {
    if (open && allProducts.length === 0) {
      import("@/lib/supabase/client").then(async ({ createClient }) => {
        const supabase = createClient();
        const { data } = await supabase
          .from("products")
          .select("sku, urun_adi")
          .eq("aktif_mi", true)
          .order("sku");
        if (data) setAllProducts(data as { sku: string; urun_adi: string }[]);
      });
    }
  }, [open, allProducts.length]);

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

  const selectedProduct = allProducts.find((p) => p.sku === selectedSku);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
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
            {step === 1 ? "Yeni Kutu Üretimi — Seçimler" : "Yeni Kutu Üretimi — Detaylar"}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-6">
            {/* 1. Ürün Seçimi */}
            <div className="space-y-3">
              <label className="text-sm font-medium">1. Ürün Seçin</label>

              {/* Hızlı butonlar */}
              {topSkus.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {topSkus.map((sku) => (
                    <Button
                      key={sku}
                      variant={selectedSku === sku ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setSelectedSku(sku)}
                    >
                      {sku}
                    </Button>
                  ))}
                </div>
              )}

              {/* Combobox */}
              <Popover open={skuOpen} onOpenChange={setSkuOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {selectedProduct ? (
                      <span className="truncate">{selectedSku} — {selectedProduct.urun_adi}</span>
                    ) : selectedSku ? (
                      <span>{selectedSku}</span>
                    ) : (
                      <span className="text-muted-foreground">SKU ara...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="SKU veya ürün adı ara..." />
                    <CommandList>
                      <CommandEmpty>Ürün bulunamadı</CommandEmpty>
                      <CommandGroup>
                        {allProducts.map((p) => (
                          <CommandItem
                            key={p.sku}
                            value={`${p.sku} ${p.urun_adi}`}
                            onSelect={() => {
                              setSelectedSku(p.sku);
                              setSkuOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedSku === p.sku ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="font-mono text-xs mr-2">{p.sku}</span>
                            <span className="truncate text-sm">{p.urun_adi}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* 2. Karton Şablon Seçimi */}
            {selectedSku && (
              <div className="space-y-3">
                <label className="text-sm font-medium">2. Karton Şablon Seçin</label>

                {loadingSablonlar ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
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
                              <p className="font-medium text-sm truncate">{s.plaka_adi}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {s.tipi && (
                                  <Badge variant="outline" className="text-[10px]">{s.tipi}</Badge>
                                )}
                                {s.renk && (
                                  <Badge variant="outline" className="text-[10px]">{s.renk}</Badge>
                                )}
                                {s.kutu_sure_dk != null && (
                                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700">
                                    {s.kutu_sure_dk} dk
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              {/* Parça stok badge */}
                              {s.part_adi && (
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground truncate max-w-[100px]">{s.part_adi}</p>
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
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            {/* Özet */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ürün:</span>
                <span className="font-medium">{selectedSku}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Şablon:</span>
                <span className="font-medium truncate ml-4">{selectedSablon?.plaka_adi}</span>
              </div>
              {selectedSablon?.part_adi && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Çıkan Parça:</span>
                  <span className="font-medium truncate ml-4">{selectedSablon.part_adi}</span>
                </div>
              )}
            </div>

            {/* Adet */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Adet</label>
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Operatör</label>
                <div className="grid grid-cols-2 gap-2">
                  {operators.map((op) => (
                    <Button
                      key={op.user_id}
                      variant={selectedOperator?.user_id === op.user_id ? "default" : "outline"}
                      className="justify-start h-10 text-sm"
                      onClick={() => setSelectedOperator(
                        selectedOperator?.user_id === op.user_id ? null : op
                      )}
                    >
                      <User className="w-4 h-4 mr-2 shrink-0" />
                      <span className="truncate">{op.full_name}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Not */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Not (opsiyonel)</label>
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

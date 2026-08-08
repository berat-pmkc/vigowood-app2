"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AdetInput } from "./adet-input";
import {
  getActiveProducts,
  getPlakalarForKesim,
  getTopCutSkus,
  getKesimOperators,
  createCutBatch,
} from "../actions";
import {
  KESIM_MAKINE_IDS,
  MAKINE_LABELS,
  type KesimMakineId,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  Scissors,
  Search,
  ArrowLeft,
  Loader2,
  CheckCircle,
  User,
} from "lucide-react";
import { toast } from "sonner";

interface YeniKesimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Bir kesim talebinden başlatıldıysa form önceden doldurulur ve kesim
   * kaydı talebe bağlanır — trigger kalan adedi talepten düşer.
   */
  talep?: {
    talep_id: string;
    sku: string;
    plaka_id: string;
    kalan_adet: number;
    plaka_adi: string | null;
  } | null;
}

interface ProductOption {
  sku: string;
  urun_adi: string | null;
  kategori: string | null;
}

interface PlakaOption {
  plakalar_id: string;
  plaka_id: string;
  plaka_adi: string | null;
  sku: string[] | null;
  tipi: string | null;
  renk: string | null;
  kesim_sureleri: Record<string, number | null>;
}

interface TopSku {
  sku: string;
  count: number;
  urun_adi: string;
}

interface Operator {
  user_id: string;
  full_name: string;
  station: string | null;
}

const MAKINE_CARD_COLORS: Record<string, { bg: string; border: string; activeBg: string }> = {
  "MAK-1": { bg: "hover:bg-emerald-50", border: "border-emerald-200", activeBg: "bg-emerald-100 border-emerald-400" },
  "MAK-2": { bg: "hover:bg-blue-50", border: "border-blue-200", activeBg: "bg-blue-100 border-blue-400" },
  "MAK-3": { bg: "hover:bg-purple-50", border: "border-purple-200", activeBg: "bg-purple-100 border-purple-400" },
};

export function YeniKesimDialog({ open, onOpenChange, talep }: YeniKesimDialogProps) {
  // Step 1: Seçimler (makine, ürün, plaka) → Step 2: Adet, operatör, kaydet
  const [step, setStep] = useState<1 | 2>(1);

  // Selections
  const [selectedMakine, setSelectedMakine] = useState<KesimMakineId | null>(null);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [selectedSkuLabel, setSelectedSkuLabel] = useState<string>("");
  const [selectedPlaka, setSelectedPlaka] = useState<PlakaOption | null>(null);
  const [adet, setAdet] = useState(1);
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);
  const [selectedOperatorName, setSelectedOperatorName] = useState<string>("");

  // Data
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [topSkus, setTopSkus] = useState<TopSku[]>([]);
  const [plakalar, setPlakalar] = useState<PlakaOption[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);

  // Loading states
  const [productsLoading, setProductsLoading] = useState(false);
  const [plakalarLoading, setPlakalarLoading] = useState(false);
  const [operatorsLoading, setOperatorsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Search
  const [skuSearch, setSkuSearch] = useState("");

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedMakine(null);
      setSelectedSku(talep?.sku ?? null);
      setSelectedSkuLabel(talep?.sku ?? "");
      setSelectedPlaka(null);
      setAdet(talep?.kalan_adet && talep.kalan_adet > 0 ? talep.kalan_adet : 1);
      setSelectedOperator(null);
      setSelectedOperatorName("");
      setSkuSearch("");
      setPlakalar([]);

      // Load products + top skus + operators
      setProductsLoading(true);
      setOperatorsLoading(true);
      Promise.all([
        getActiveProducts(),
        getTopCutSkus(10),
        getKesimOperators(),
      ]).then(([prodRes, topRes, opRes]) => {
        if (prodRes.success) setProducts(prodRes.data);
        if (topRes.success) setTopSkus(topRes.data);
        if (opRes.success) setOperators(opRes.data);
        setProductsLoading(false);
        setOperatorsLoading(false);
      });
    }
  }, [open, talep]);

  // When sku selected, load plakalar (plakalar makineye bağlı değil, sadece SKU'ya bağlı)
  useEffect(() => {
    if (selectedSku) {
      setPlakalarLoading(true);
      setSelectedPlaka(null);
      getPlakalarForKesim(selectedSku).then((res) => {
        if (res.success) {
          setPlakalar(res.data);
          // Talepten gelindiyse ilgili plakayı otomatik seç
          if (talep && talep.sku === selectedSku) {
            const eslesen = res.data.find((p) => p.plaka_id === talep.plaka_id);
            if (eslesen) setSelectedPlaka(eslesen);
          }
        }
        setPlakalarLoading(false);
      });
    } else {
      setPlakalar([]);
    }
  }, [selectedSku, talep]);

  // Auto-advance to step 2 when all selections made
  useEffect(() => {
    if (selectedMakine && selectedSku && selectedPlaka && step === 1) {
      setStep(2);
    }
  }, [selectedMakine, selectedSku, selectedPlaka, step]);

  const handleSkuSelect = useCallback((sku: string, label: string) => {
    setSelectedSku(sku);
    setSelectedSkuLabel(label);
    setSelectedPlaka(null);
  }, []);

  const handleSave = async () => {
    if (!selectedMakine || !selectedSku || !selectedPlaka || !selectedOperator) return;

    setSaving(true);
    const result = await createCutBatch({
      talep_id: talep?.talep_id ?? null,
      makine_id: selectedMakine,
      sku: selectedSku,
      plaka_id: selectedPlaka.plaka_id,
      adet,
      operator_id: selectedOperator,
      plk_notu: null,
    });

    if (result.success) {
      toast.success("Kesim kaydedildi");
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
    setSaving(false);
  };

  const filteredProducts = skuSearch
    ? products.filter(
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
            <Scissors className="w-5 h-5" />
            {talep ? "Talep İçin Kesim" : "Yeni Kesim"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {/* Hangi talebin karşılandığı görünsün — yanlış talebe kesim yapılmasın */}
          {talep && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="text-xs text-amber-900">
                <span className="font-mono font-semibold">{talep.talep_id}</span> talebi
                karşılanıyor — <strong>{talep.plaka_adi ?? talep.plaka_id}</strong>, kalan{" "}
                <strong>{talep.kalan_adet} plaka</strong>. Ürün ve plaka önceden seçildi,
                adet gerekirse değiştirilebilir.
              </p>
            </div>
          )}
          {step === 1 && (
            <>
              {/* 1. Makine Seçimi */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">1. Makine</h3>
                <div className="grid grid-cols-3 gap-2">
                  {KESIM_MAKINE_IDS.map((id) => {
                    const colors = MAKINE_CARD_COLORS[id];
                    const isSelected = selectedMakine === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        className={cn(
                          "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all",
                          isSelected
                            ? colors.activeBg
                            : `border-muted ${colors.bg}`
                        )}
                        onClick={() => {
                          setSelectedMakine(id);
                          setSelectedPlaka(null);
                        }}
                      >
                        <Scissors className="w-5 h-5" />
                        <span className="text-xs font-medium">{id}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {MAKINE_LABELS[id]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Ürün Seçimi */}
              {selectedMakine && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    2. Ürün
                    {selectedSku && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {selectedSku}
                        <button
                          type="button"
                          className="ml-1 hover:text-destructive"
                          onClick={() => {
                            setSelectedSku(null);
                            setSelectedSkuLabel("");
                            setSelectedPlaka(null);
                          }}
                        >
                          ×
                        </button>
                      </Badge>
                    )}
                  </h3>

                  {!selectedSku && (
                    <>
                      {/* Search combobox */}
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
                              onClick={() => {
                                handleSkuSelect(p.sku, p.urun_adi ?? p.sku);
                                setSkuSearch("");
                              }}
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

                      {/* Top SKUs quick buttons */}
                      {!skuSearch && topSkus.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1.5">En çok kesilen:</p>
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
              )}

              {/* 3. Plaka Seçimi (SKU seçildiğinde görünür, makine bağımsız) */}
              {selectedSku && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">3. Plaka</h3>

                  {plakalarLoading ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                    </div>
                  ) : plakalar.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Bu ürün için plaka bulunamadı
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {plakalar.map((p) => {
                        const isSelected = selectedPlaka?.plaka_id === p.plaka_id;
                        const sureDk = selectedMakine ? p.kesim_sureleri[selectedMakine] : null;
                        return (
                          <button
                            key={p.plakalar_id}
                            type="button"
                            className={cn(
                              "text-left p-3 rounded-lg border-2 transition-all",
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-muted hover:border-primary/30"
                            )}
                            onClick={() => setSelectedPlaka(p)}
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium text-sm">{p.plaka_adi ?? p.plaka_id}</p>
                                <p className="text-xs text-muted-foreground">
                                  {[p.tipi, p.renk].filter(Boolean).join(" • ") || p.plaka_id}
                                </p>
                              </div>
                              {sureDk != null && (
                                <Badge variant="outline" className="text-xs">
                                  {sureDk} dk
                                </Badge>
                              )}
                            </div>
                          </button>
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
              {/* Back button + Summary */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Geri
                </Button>
                <div className="flex gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-xs">{selectedMakine}</Badge>
                  <Badge variant="secondary" className="text-xs">{selectedSku}</Badge>
                  <Badge variant="outline" className="text-xs">{selectedPlaka?.plaka_adi ?? selectedPlaka?.plaka_id}</Badge>
                </div>
              </div>

              {/* Adet */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Adet</h3>
                <AdetInput value={adet} onChange={setAdet} />
              </div>

              {/* Operatör */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Operatör</h3>
                {operatorsLoading ? (
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : operators.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Kesim operatörü bulunamadı</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {operators.map((op) => (
                      <button
                        key={op.user_id}
                        type="button"
                        className={cn(
                          "flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all text-left",
                          selectedOperator === op.user_id
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:border-primary/30"
                        )}
                        onClick={() => {
                          setSelectedOperator(op.user_id);
                          setSelectedOperatorName(op.full_name);
                        }}
                      >
                        <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium truncate">{op.full_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Özet + Kaydet */}
              <div className="pt-2 border-t space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Makine:</span>{" "}
                    <span className="font-medium">{selectedMakine ? MAKINE_LABELS[selectedMakine] : "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ürün:</span>{" "}
                    <span className="font-medium">{selectedSkuLabel || selectedSku}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Plaka:</span>{" "}
                    <span className="font-medium">{selectedPlaka?.plaka_adi ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Adet:</span>{" "}
                    <span className="font-bold text-lg">{adet}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Operatör:</span>{" "}
                    <span className="font-medium">{selectedOperatorName || "—"}</span>
                  </div>
                </div>

                <Button
                  className="w-full h-14 text-base"
                  onClick={handleSave}
                  disabled={saving || !selectedOperator}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Kaydediliyor...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Kaydet
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

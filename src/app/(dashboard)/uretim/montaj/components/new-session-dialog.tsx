"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, ArrowLeft, Users, X, Check } from "lucide-react";
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

/**
 * Türkçe duyarlı normalleştirme.
 * Önceki sürüm cmdk'nın bulanık (fuzzy) skorlamasına bırakılmıştı; bazı
 * ürünler (ör. LS011) aramada görünmüyordu. Artık filtre burada, açık ve
 * belirlenebilir: küçük harfe indir, Türkçe karakterleri sadeleştir, içeriyor
 * mu diye bak. Sürprizi olmayan davranış.
 */
function normalize(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .trim();
}

export function NewSessionDialog({ open, onOpenChange }: NewSessionDialogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [topLoading, setTopLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSku, setSelectedSku] = useState("");
  const [arama, setArama] = useState("");

  const [activeStep, setActiveStep] = useState<1 | 2>(1);
  const [steps, setSteps] = useState<StepInfo[]>([]);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState("");
  const [stepsCache, setStepsCache] = useState<Map<string, StepInfo[]>>(new Map());
  const [operators, setOperators] = useState<Operator[]>([]);
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());

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
          else toast.error(result.error);
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
      setArama("");
      setSelectedWorkers(new Set());
    }
  }, [open, products.length, topProducts.length, operators.length]);

  // Adımları SKU seçilir seçilmez yükle
  useEffect(() => {
    if (!selectedSku) return;
    const cached = stepsCache.get(selectedSku);
    if (cached) { setSteps(cached); return; }

    setStepsLoading(true);
    getStepsForProduct(selectedSku).then((result) => {
      if (result.success) {
        setSteps(result.data);
        setStepsCache((prev) => new Map(prev).set(selectedSku, result.data));
      } else {
        toast.error(result.error);
        setSteps([]);
      }
      setStepsLoading(false);
    });
  }, [selectedSku, stepsCache]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.sku === selectedSku),
    [products, selectedSku],
  );

  const listelenen = useMemo(() => {
    if (!arama.trim()) return products;
    const q = normalize(arama);
    return products.filter(
      (p) => normalize(p.sku).includes(q) || normalize(p.urun_adi ?? "").includes(q),
    );
  }, [products, arama]);

  const toggleWorker = (id: string) => {
    setSelectedWorkers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  /** Ürüne dokununca doğrudan adım ekranına geç — ayrı "Devam" adımı yok */
  const urunSec = (sku: string) => {
    setSelectedSku(sku);
    setSelectedStepId("");
    setActiveStep(2);
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
      {/*
        Tablet ve telefonda tam ekran: önceki halde diyalog küçük kalıyor,
        ürün listesi popover içinde sıkışıyordu. Masaüstünde eski genişlik
        korunuyor.
      */}
      <DialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          "max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:border-0",
          "sm:max-w-lg sm:max-h-[85vh]",
        )}
        showCloseButton={false}
      >
        {/* ── Başlık ─────────────────────────────────────── */}
        <DialogHeader className="shrink-0 flex-row items-center gap-2 space-y-0 border-b px-4 py-3">
          {activeStep === 2 && (
            <Button
              variant="ghost" size="icon" className="size-9 shrink-0"
              onClick={() => { setActiveStep(1); setSelectedStepId(""); }}
              aria-label="Geri"
            >
              <ArrowLeft className="size-5" />
            </Button>
          )}
          <DialogTitle className="min-w-0 flex-1 truncate text-base">
            {activeStep === 1 ? "Ürün seç" : "Montaj adımı seç"}
          </DialogTitle>
          <Button
            variant="ghost" size="icon" className="size-9 shrink-0"
            onClick={() => onOpenChange(false)}
            aria-label="Kapat"
          >
            <X className="size-5" />
          </Button>
        </DialogHeader>

        {/* ── Kaydırmalı gövde ───────────────────────────── */}
        <div className="relative flex-1 overflow-hidden">
          {activeStep === 1 ? (
            <div className="flex h-full flex-col animate-in fade-in slide-in-from-left-4 duration-200">
              {/* Arama — her zaman görünür, popover içinde değil */}
              <div className="shrink-0 space-y-3 border-b p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={arama}
                    onChange={(e) => setArama(e.target.value)}
                    placeholder="Ürün kodu veya adı ara..."
                    className="h-12 pl-9 pr-9 text-base"
                    autoComplete="off"
                  />
                  {arama && (
                    <button
                      type="button"
                      onClick={() => setArama("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
                      aria-label="Aramayı temizle"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>

                {/* Hızlı seçim — en çok montajlananlar */}
                {topLoading ? (
                  <div className="flex justify-center py-1">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : topProducts.length > 0 && !arama ? (
                  <div className="flex flex-wrap gap-1.5">
                    {topProducts.slice(0, 8).map((p) => (
                      <button
                        key={p.sku}
                        type="button"
                        onClick={() => urunSec(p.sku)}
                        className="rounded-full border px-3 py-1.5 text-xs font-medium hover:border-vw-side hover:bg-muted/50"
                      >
                        {p.sku}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Ürün listesi — kalan tüm yüksekliği doldurur */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Ürünler yükleniyor...
                  </div>
                ) : listelenen.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    &quot;{arama}&quot; için ürün bulunamadı.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {listelenen.map((p) => (
                      <li key={p.sku}>
                        <button
                          type="button"
                          onClick={() => urunSec(p.sku)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-muted/60 hover:bg-muted/40"
                        >
                          <span
                            className="shrink-0 rounded px-2 py-1 text-xs font-bold"
                            style={{
                              backgroundColor: getSkuBadgeStyle(p.sku).backgroundColor,
                              color: getSkuBadgeStyle(p.sku).color,
                            }}
                          >
                            {p.sku}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                            {p.urun_adi ?? ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="shrink-0 border-t px-4 py-2 text-center text-xs text-muted-foreground">
                {loading ? "—" : `${listelenen.length} ürün${arama ? ` (toplam ${products.length})` : ""}`}
              </div>
            </div>
          ) : (
            /* ── Adım 2: yandan kayarak gelir ── */
            <div className="flex h-full flex-col animate-in fade-in slide-in-from-right-6 duration-200">
              {/* Seçilen ürün */}
              <div
                className="shrink-0 border-b px-4 py-3"
                style={{ backgroundColor: getSkuBadgeStyle(selectedSku).backgroundColor }}
              >
                <span className="text-sm font-bold" style={{ color: getSkuBadgeStyle(selectedSku).color }}>
                  {selectedSku}
                </span>
                <p className="truncate text-xs text-muted-foreground">
                  {selectedProduct?.urun_adi ?? ""}
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {stepsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Adımlar yükleniyor...
                  </div>
                ) : steps.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Bu ürüne ait montaj adımı bulunamadı.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {steps.map((step) => {
                      const secili = selectedStepId === step.step_id;
                      return (
                        <li key={step.step_id}>
                          <button
                            type="button"
                            onClick={() => setSelectedStepId(step.step_id)}
                            className={cn(
                              "flex w-full items-center gap-3 px-4 py-3.5 text-left",
                              secili ? "bg-vw-primary/10" : "active:bg-muted/60 hover:bg-muted/40",
                            )}
                          >
                            <span className={cn(
                              "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                              secili ? "bg-vw-primary text-white" : "bg-muted text-muted-foreground",
                            )}>
                              {secili ? <Check className="size-4" /> : step.seq_no}
                            </span>
                            <span className="min-w-0 flex-1 text-sm font-medium">
                              {step.step_name || step.step_id}
                            </span>
                            {step.is_final_step && (
                              <Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-50 text-xs text-emerald-700">
                                Son
                              </Badge>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Çalışanlar — burada seçiliyor, seans kapanışında tekrar sorulmuyor */}
                {selectedStepId && (
                  <div className="border-t p-4">
                    <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <Users className="size-4" />
                      Çalışanlar ({selectedWorkers.size} kişi)
                    </p>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Seansı kapatırken tekrar sorulmayacak — burada seçin.
                    </p>
                    <div className="space-y-0.5 rounded-lg border p-1">
                      {operators.map((op) => (
                        <label
                          key={op.user_id}
                          className="flex cursor-pointer items-center gap-3 rounded-md p-2.5 hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={selectedWorkers.has(op.user_id)}
                            onCheckedChange={() => toggleWorker(op.user_id)}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">{op.full_name}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{op.user_id}</span>
                        </label>
                      ))}
                      {operators.length === 0 && (
                        <p className="py-2 text-center text-sm text-muted-foreground">
                          Operatör bulunamadı
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Sabit alt buton — telefonda her zaman erişilebilir */}
              <div className="shrink-0 border-t p-3">
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedStepId || selectedWorkers.size === 0 || submitting}
                  className="h-12 w-full bg-vw-primary text-base text-white hover:bg-vw-deep"
                >
                  {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Seansı Başlat
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

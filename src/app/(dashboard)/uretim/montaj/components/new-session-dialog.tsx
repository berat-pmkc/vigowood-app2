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
import { Label } from "@/components/ui/label";
import { Loader2, Search, ArrowLeft, Users, X, Check, StickyNote } from "lucide-react";
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

/** İş talimatından "Seans Başlat": ürün + çalışan önceden dolu */
export interface TalimatSeansOnDolu {
  satir_id: string;
  sku: string;
  urun_adi: string | null;
  personel_id: string;
  personel_adi: string;
  not_text: string | null;
}

interface NewSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  talimat?: TalimatSeansOnDolu | null;
  /** "Ek Seans Aç": plan dışı seans — çalışan sabit, ürün serbest */
  ekSeans?: { personel_id: string; personel_adi: string } | null;
  /** Seans başarıyla başlayınca (dialog kapanmadan önce) */
  onSuccess?: () => void;
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

export function NewSessionDialog({ open, onOpenChange, talimat, ekSeans, onSuccess }: NewSessionDialogProps) {
  /** Çıkarılamayan (sabit) çalışan: talimat sahibi veya ek seansı açan */
  const kilitliPersonel = talimat?.personel_id ?? ekSeans?.personel_id ?? null;
  const kilitliAd = talimat?.personel_adi ?? ekSeans?.personel_adi ?? null;
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
  /** Listede olmayan yardımcı sayısı (yardimci_sayisi) */
  const [yardimciSayisi, setYardimciSayisi] = useState(0);

  // Talimattan açıldıysa: ürün + çalışan hazır, doğrudan adım ekranı
  const talimatSatirId = talimat?.satir_id;
  const talimatSku = talimat?.sku;
  const talimatPersonel = talimat?.personel_id;
  const ekPersonel = ekSeans?.personel_id;
  useEffect(() => {
    if (!open || !ekPersonel) return;
    setSelectedWorkers(new Set([ekPersonel]));
    setYardimciSayisi(0);
  }, [open, ekPersonel]);

  useEffect(() => {
    if (!open || !talimatSatirId) return;
    setSelectedSku(talimatSku ?? "");
    setSelectedStepId("");
    setActiveStep(2);
    setSelectedWorkers(new Set(talimatPersonel ? [talimatPersonel] : []));
    setYardimciSayisi(0);
  }, [open, talimatSatirId, talimatSku, talimatPersonel]);

  useEffect(() => {
    if (open) {
      if (topProducts.length === 0 && !talimat) {
        setTopLoading(true);
        getTopMontajProducts(10).then((result) => {
          if (result.success) setTopProducts(result.data);
          setTopLoading(false);
        });
      }
      if (products.length === 0 && !talimat) {
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
      setYardimciSayisi(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const secilenAdim = useMemo(
    () => steps.find((s) => s.step_id === selectedStepId) ?? null,
    [steps, selectedStepId],
  );

  const listelenen = useMemo(() => {
    if (!arama.trim()) return products;
    const q = normalize(arama);
    return products.filter(
      (p) => normalize(p.sku).includes(q) || normalize(p.urun_adi ?? "").includes(q),
    );
  }, [products, arama]);

  const toggleWorker = (id: string) => {
    // Talimat çalışanı kendisi: çıkarılamaz
    if (kilitliPersonel && id === kilitliPersonel) return;
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
      return { id, name: op?.full_name ?? (kilitliPersonel && id === kilitliPersonel ? (kilitliAd ?? id) : id) };
    });

    setSubmitting(true);
    const result = await createMontajSession(
      selectedSku,
      selectedStepId,
      workers,
      talimat
        ? { talimatSatirId: talimat.satir_id, yardimciSayisi }
        : ekSeans
          ? { ekSeans: true, yardimciSayisi }
          : undefined,
    );
    if (result.success) {
      toast.success(ekSeans ? "Ek seans başlatıldı" : "Montaj seansı başlatıldı");
      onSuccess?.();
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
          // Yükseklik BELİRLİ olmalı: yalnızca max-h verilirse iç flex
          // zinciri yüksekliği çözemiyor, liste taşıp alt buton diyaloğun
          // dışında kalıyordu.
          "flex flex-col gap-0 overflow-hidden p-0",
          "max-sm:h-[100dvh] max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:border-0",
          "sm:h-[min(85vh,44rem)] sm:max-w-lg",
        )}
        showCloseButton={false}
      >
        {/* ── Başlık ─────────────────────────────────────── */}
        <DialogHeader className="shrink-0 flex-row items-center gap-2 space-y-0 border-b px-4 py-3">
          {activeStep === 2 && !talimat && (
            <Button
              variant="ghost" size="icon" className="size-9 shrink-0"
              onClick={() => { setActiveStep(1); setSelectedStepId(""); }}
              aria-label="Geri"
            >
              <ArrowLeft className="size-5" />
            </Button>
          )}
          <DialogTitle className="min-w-0 flex-1 truncate text-base">
            {activeStep === 1 && !talimat ? (ekSeans ? "Ek Seans — Ürün seç" : "Ürün seç") : "Montaj adımı seç"}
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
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {activeStep === 1 && !talimat ? (
            <div className="flex min-h-0 flex-1 flex-col animate-in fade-in slide-in-from-left-4 duration-200">
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
            <div className="flex min-h-0 flex-1 flex-col animate-in fade-in slide-in-from-right-6 duration-200">
              {/* Seçilen ürün */}
              <div
                className="shrink-0 border-b px-4 py-3"
                style={{ backgroundColor: getSkuBadgeStyle(selectedSku).backgroundColor }}
              >
                <span className="text-sm font-bold" style={{ color: getSkuBadgeStyle(selectedSku).color }}>
                  {selectedSku}
                </span>
                <p className="truncate text-xs text-muted-foreground">
                  {selectedProduct?.urun_adi ?? talimat?.urun_adi ?? ""}
                </p>
                {talimat?.not_text && (
                  <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-900">
                    <StickyNote className="mt-0.5 size-4 shrink-0" />
                    <span className="whitespace-pre-wrap">{talimat.not_text}</span>
                  </div>
                )}
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
                ) : secilenAdim ? (
                  /*
                   * Adım seçilince liste katlanıyor. Açık bırakılsaydı
                   * kullanıcının çalışan seçimine ulaşmak için 14 adımı
                   * kaydırması gerekiyordu — küçük ekranda kaybolan bir akış.
                   */
                  <div className="p-4">
                    <div className="flex items-center gap-3 rounded-lg border border-vw-primary bg-vw-primary/10 p-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-vw-primary text-white">
                        <Check className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {secilenAdim.step_name || secilenAdim.step_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Adım {secilenAdim.seq_no}
                          {secilenAdim.is_final_step ? " · Son adım" : ""}
                        </p>
                      </div>
                      <Button
                        variant="ghost" size="sm" className="shrink-0"
                        onClick={() => setSelectedStepId("")}
                      >
                        Değiştir
                      </Button>
                    </div>

                    {/* Çalışanlar — seans kapanışında tekrar sorulmuyor */}
                    <div className="mt-4">
                      <p className="mb-1 flex items-center gap-2 text-sm font-medium">
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
                            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md p-2.5 hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={selectedWorkers.has(op.user_id)}
                              disabled={kilitliPersonel === op.user_id}
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
                      {(talimat || ekSeans) && (
                        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border p-3">
                          <Label htmlFor="yardimci-sayisi" className="text-sm">
                            Listede olmayan yardımcı sayısı
                          </Label>
                          <Input
                            id="yardimci-sayisi"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={50}
                            value={yardimciSayisi}
                            onChange={(e) =>
                              setYardimciSayisi(Math.max(0, Math.min(50, Math.floor(Number(e.target.value)) || 0)))
                            }
                            className="h-12 w-24 text-center text-lg"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <ul className="divide-y">
                    {steps.map((step) => (
                      <li key={step.step_id}>
                        <button
                          type="button"
                          onClick={() => setSelectedStepId(step.step_id)}
                          className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40 active:bg-muted/60"
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                            {step.seq_no}
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
                    ))}
                  </ul>
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

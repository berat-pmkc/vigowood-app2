"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Lock, Play, Search, Square, StickyNote, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { TabletHatSatir, TabletHatSeans, TalimatHat } from "@/lib/talimat/types";
import { createMontajSession, getMontajOperators, getStepsForProduct } from "../../montaj/actions";
import { createPackSession, getPackOperators } from "../../paketleme/actions";
import { AcikSeansKarti } from "./acik-seans-karti";

function normalize(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .trim();
}

const dlgBoyut = cn(
  "flex flex-col gap-0 overflow-hidden p-0",
  "max-sm:h-[100dvh] max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:border-0",
  "sm:h-[min(88vh,46rem)] sm:max-w-xl",
);

function UrunBaslik({ satir }: { satir: TabletHatSatir }) {
  return (
    <div className="shrink-0 border-b bg-muted/40 px-4 py-3">
      <p className="text-xl font-bold leading-tight">{satir.urun_adi ?? satir.sku}</p>
      <p className="text-sm text-muted-foreground">{satir.sku}</p>
      {satir.not_text?.trim() && (
        <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-900">
          <StickyNote className="mt-0.5 size-4 shrink-0" />
          <span className="whitespace-pre-wrap">{satir.not_text}</span>
        </div>
      )}
    </div>
  );
}

/** "Seans işlemi": iki büyük düğme — Seans Aç / Seans Kapat */
export function SeansIslemiDialog({
  satir, hat, open, onClose, onAc, onKapat,
}: {
  satir: TabletHatSatir | null;
  hat: TalimatHat | null;
  open: boolean;
  onClose: () => void;
  onAc: () => void;
  onKapat: () => void;
}) {
  const acikSayi = satir?.acik_seanslar.length ?? 0;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="text-lg">{hat?.ad} — Seans işlemi</DialogTitle>
        </DialogHeader>
        {satir && (
          <div className="space-y-4 p-4">
            <div>
              <p className="text-xl font-bold leading-tight">{satir.urun_adi ?? satir.sku}</p>
              <p className="text-sm text-muted-foreground">{satir.sku}</p>
            </div>
            <Button
              className="h-24 w-full flex-col gap-1 bg-vw-success text-2xl font-bold text-white hover:bg-vw-success/90"
              onClick={onAc}
            >
              <Play className="size-8" />
              Seans Aç
            </Button>
            <Button
              variant="outline"
              disabled={acikSayi === 0}
              className="h-24 w-full flex-col gap-1 border-2 border-[#ee7683] text-2xl font-bold text-[#b3202f] hover:bg-[#ee7683]/10"
              onClick={onKapat}
            >
              <Square className="size-8" />
              Seans Kapat{acikSayi > 0 ? ` (${acikSayi} açık)` : ""}
            </Button>
            {acikSayi === 0 && <p className="text-center text-sm text-muted-foreground">Bu üründe açık seans yok</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Seans Kapat: bu ürünün bu hattaki açık seansları -> birini seç (kapatma penceresi dışarıda açılır) */
export function SeansKapatListeDialog({
  satir, hat, open, onClose, onBeklet, onKapat,
}: {
  satir: TabletHatSatir | null;
  hat: TalimatHat | null;
  open: boolean;
  onClose: () => void;
  onBeklet: (s: TabletHatSeans) => Promise<void>;
  onKapat: (s: TabletHatSeans) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={dlgBoyut} showCloseButton={false}>
        <DialogHeader className="shrink-0 flex-row items-center gap-2 space-y-0 border-b px-4 py-3">
          <DialogTitle className="min-w-0 flex-1 truncate text-lg">{hat?.ad} — Seans Kapat</DialogTitle>
          <Button variant="ghost" size="icon" className="size-10" onClick={onClose} aria-label="Kapat">
            <X className="size-5" />
          </Button>
        </DialogHeader>
        {satir && <UrunBaslik satir={satir} />}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <p className="text-base font-semibold">Hangi seansı kapatacaksın?</p>
          {satir?.acik_seanslar.map((x) => (
            <AcikSeansKarti key={x.session_id} x={x} onBeklet={onBeklet} onKapat={onKapat} />
          ))}
          {satir && satir.acik_seanslar.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">Açık seans kalmadı</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface Calisan {
  user_id: string;
  full_name: string;
}

/** Seans Aç: ürün sabit; montaj hatlarında aşama seç + çalışan(lar); paketlemede yalnız çalışan(lar) */
export function SeansAcDialog({
  satir, hat, open, onClose, onSuccess,
}: {
  satir: TabletHatSatir | null;
  hat: TalimatHat | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const montaj = hat?.tur === "montaj";
  const sku = satir?.sku ?? "";
  const [adimlar, setAdimlar] = useState<
    Array<{ step_id: string; step_name: string | null; seq_no: number | null; is_final_step: boolean | null }>
  >([]);
  const [adimYukleniyor, setAdimYukleniyor] = useState(false);
  const [calisanlar, setCalisanlar] = useState<Calisan[]>([]);
  const [secilenAdim, setSecilenAdim] = useState("");
  /** Seçim sırası korunur: ilki seansı yapan (asıl), diğerleri yardımcı */
  const [secilenler, setSecilenler] = useState<string[]>([]);
  const [yardimciSayisi, setYardimciSayisi] = useState(0);
  const [arama, setArama] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  useEffect(() => {
    if (!open) {
      setSecilenAdim("");
      setSecilenler([]);
      setYardimciSayisi(0);
      setArama("");
      return;
    }
    let iptal = false;
    const op = montaj ? getMontajOperators() : getPackOperators();
    op.then((r) => {
      if (!iptal && r.success) setCalisanlar(r.data as Calisan[]);
    });
    if (montaj && sku) {
      setAdimYukleniyor(true);
      getStepsForProduct(sku).then((r) => {
        if (iptal) return;
        if (r.success) setAdimlar(r.data);
        else toast.error(r.error);
        setAdimYukleniyor(false);
      });
    }
    return () => {
      iptal = true;
    };
  }, [open, montaj, sku, hat?.hat_id]);

  /** Bir çalışanın aynı ürün/aşamada açık seansı var mı (DB kuralı; seçenekleri önceden kapat) */
  const calisaninAcikSeansi = (userId: string, stepId: string | null): boolean =>
    (satir?.acik_seanslar ?? []).some(
      (s) =>
        (montaj ? s.step_id === stepId : true) &&
        (s.operator_id === userId || (s.workers ?? []).some((w) => w.id === userId)),
    );

  const adimEngelli = (stepId: string) => secilenler.some((u) => calisaninAcikSeansi(u, stepId));
  const paketEngelli = !montaj && secilenler.some((u) => calisaninAcikSeansi(u, null));

  const filtreli = useMemo(() => {
    const q = normalize(arama);
    return q ? calisanlar.filter((c) => normalize(c.full_name).includes(q) || normalize(c.user_id).includes(q)) : calisanlar;
  }, [calisanlar, arama]);

  const toggle = (id: string) =>
    setSecilenler((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Seçilen çalışan değişince aşama çakışırsa aşama seçimini bırak
  useEffect(() => {
    if (secilenAdim && adimEngelli(secilenAdim)) setSecilenAdim("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secilenler]);

  const baslat = async () => {
    if (!satir || !hat) return;
    if (montaj && !secilenAdim) return toast.error("Montaj aşamasını seç");
    if (secilenler.length === 0) return toast.error("Seansı yapan çalışanı seç");
    const workers = secilenler.map((id) => ({ id, name: calisanlar.find((c) => c.user_id === id)?.full_name ?? id }));
    setGonderiliyor(true);
    const r = montaj
      ? await createMontajSession(sku, secilenAdim, workers, {
          talimatSatirId: satir.satir_id,
          yardimciSayisi,
          hatId: hat.hat_id,
        })
      : await createPackSession(sku, { talimatSatirId: satir.satir_id, workers, yardimciSayisi, hatId: hat.hat_id });
    setGonderiliyor(false);
    if (r.success) {
      toast.success("Seans başlatıldı");
      onSuccess();
    } else {
      toast.error(r.error);
    }
  };

  const hazir = secilenler.length > 0 && (!montaj || !!secilenAdim) && !paketEngelli;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={dlgBoyut} showCloseButton={false}>
        <DialogHeader className="shrink-0 flex-row items-center gap-2 space-y-0 border-b px-4 py-3">
          <DialogTitle className="min-w-0 flex-1 truncate text-lg">{hat?.ad} — Seans Aç</DialogTitle>
          <Button variant="ghost" size="icon" className="size-10" onClick={onClose} aria-label="Kapat">
            <X className="size-5" />
          </Button>
        </DialogHeader>
        {satir && <UrunBaslik satir={satir} />}

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4">
          {montaj && (
            <section>
              <h3 className="mb-2 text-base font-bold">1. Aşamayı seç</h3>
              {adimYukleniyor ? (
                <div className="flex items-center gap-2 py-6 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" /> Aşamalar yükleniyor...
                </div>
              ) : adimlar.length === 0 ? (
                <p className="rounded-lg border-2 border-dashed p-4 text-center text-muted-foreground">
                  Bu ürüne ait montaj aşaması yok
                </p>
              ) : (
                <ul className="space-y-2">
                  {adimlar.map((a) => {
                    const engelli = adimEngelli(a.step_id);
                    const sec = secilenAdim === a.step_id;
                    return (
                      <li key={a.step_id}>
                        <button
                          type="button"
                          disabled={engelli}
                          onClick={() => setSecilenAdim(a.step_id)}
                          className={cn(
                            "flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-3 text-left",
                            sec ? "border-vw-deep bg-vw-primary/20" : "border-border bg-card",
                            engelli && "cursor-not-allowed opacity-45",
                          )}
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-base font-bold">
                            {a.seq_no}
                          </span>
                          <span className="min-w-0 flex-1 text-base font-semibold">{a.step_name || a.step_id}</span>
                          {a.is_final_step && (
                            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Son aşama</span>
                          )}
                          {engelli && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-[#b3202f]">
                              <Lock className="size-4" /> Açık seansı var
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          <section>
            <h3 className="mb-1 flex items-center gap-2 text-base font-bold">
              <Users className="size-5" />
              {montaj ? "2. " : "1. "}Kim yapıyor? ({secilenler.length} kişi)
            </h3>
            <p className="mb-2 text-sm text-muted-foreground">
              İlk seçtiğin kişi seansı yapan, diğerleri yardımcı olarak kaydedilir.
            </p>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={arama}
                onChange={(e) => setArama(e.target.value)}
                placeholder="İsim ara"
                className="h-12 pl-9 text-base"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1 rounded-xl border p-1">
              {filtreli.map((c) => {
                const sira = secilenler.indexOf(c.user_id);
                return (
                  <label
                    key={c.user_id}
                    className={cn(
                      "flex min-h-14 cursor-pointer items-center gap-3 rounded-lg px-3",
                      sira >= 0 ? "bg-vw-primary/15" : "hover:bg-muted/50",
                    )}
                  >
                    <Checkbox checked={sira >= 0} onCheckedChange={() => toggle(c.user_id)} className="size-6" />
                    <span className="min-w-0 flex-1 truncate text-base font-medium">{c.full_name}</span>
                    {sira === 0 && (
                      <span className="rounded-full bg-vw-deep px-2 py-0.5 text-xs font-bold text-white">Asıl</span>
                    )}
                    {sira > 0 && <span className="text-xs text-muted-foreground">Yardımcı</span>}
                  </label>
                );
              })}
              {filtreli.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">Çalışan bulunamadı</p>
              )}
            </div>
            {paketEngelli && (
              <p className="mt-2 rounded-lg bg-[#ee7683]/15 p-3 text-sm font-semibold text-[#a0303d]">
                Seçtiğin kişilerden birinin bu üründe zaten açık seansı var. Önce onu kapat.
              </p>
            )}
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border p-3">
              <Label htmlFor="hat-yardimci" className="text-base">
                Listede olmayan yardımcı sayısı
              </Label>
              <Input
                id="hat-yardimci"
                type="number"
                inputMode="numeric"
                min={0}
                max={50}
                value={yardimciSayisi}
                onChange={(e) => setYardimciSayisi(Math.max(0, Math.min(50, Math.floor(Number(e.target.value)) || 0)))}
                className="h-12 w-24 text-center text-xl"
              />
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t p-3">
          <Button
            onClick={baslat}
            disabled={!hazir || gonderiliyor}
            className="h-16 w-full bg-vw-success text-xl font-bold text-white hover:bg-vw-success/90"
          >
            {gonderiliyor ? <Loader2 className="mr-2 size-6 animate-spin" /> : <Play className="mr-2 size-6" />}
            Seansı Başlat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCheck, ClipboardList, Loader2, Play, Scissors, Search, StickyNote, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { DB_SCHEMA } from "@/lib/supabase/schema";
import { tabletListeGetir, talimatOnayla } from "@/lib/talimat/actions";
import { kesimBitirdiVerisiGetir, type KesimBitirdiVerisi, type TabletPersonel } from "@/lib/talimat/tablet-actions";
import { TALIMAT_ISTASYON_LABEL } from "@/lib/talimat/constants";
import { ilerlemeYuzdesi } from "@/lib/talimat/helpers";
import type { TalimatSatir, TalimatTabletListe } from "@/lib/talimat/types";
import { NewSessionDialog as MontajSeansDialog } from "../../montaj/components/new-session-dialog";
import { NewSessionDialog as PaketlemeSeansDialog } from "../../paketleme/components/new-session-dialog";
import { YeniKesimDialog } from "../../kesim/components/yeni-kesim-dialog";
import { sesHazirla } from "@/components/shared/talimat/ses";

function tarihTr(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

interface Props {
  personeller: TabletPersonel[];
  baslangicPersonelId: string | null;
  baslangicListe: TalimatTabletListe | null;
  baslangicHata: string | null;
}

export function TalimatlarimClient({ personeller, baslangicPersonelId, baslangicListe, baslangicHata }: Props) {
  const router = useRouter();
  const [personelId, setPersonelId] = useState<string | null>(baslangicPersonelId);
  const [liste, setListe] = useState<TalimatTabletListe | null>(baslangicListe);
  const [hata, setHata] = useState<string | null>(baslangicHata);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [pickerAcik, setPickerAcik] = useState(baslangicPersonelId === null);
  const [onayda, setOnayda] = useState(false);

  // Seans / kesim diyalogları
  const [montajSatir, setMontajSatir] = useState<TalimatSatir | null>(null);
  const [paketSatir, setPaketSatir] = useState<TalimatSatir | null>(null);
  const [kesimVeri, setKesimVeri] = useState<KesimBitirdiVerisi | null>(null);
  const [kesimYukleniyor, setKesimYukleniyor] = useState<string | null>(null);

  useEffect(() => {
    sesHazirla();
  }, []);

  // Kararlı nesne: diyalog açıkken liste yenilense de form sıfırlanmasın
  const kesimTalimat = useMemo(
    () =>
      kesimVeri
        ? {
            talimat_satir_id: kesimVeri.talimat_satir_id,
            sku: kesimVeri.sku ?? "",
            plaka_id: kesimVeri.plaka_id ?? "",
            plaka_adi: kesimVeri.plaka_adi,
            adet: kesimVeri.adet,
            personel_id: kesimVeri.personel_id,
            personel_adi: kesimVeri.personel_adi,
          }
        : null,
    [kesimVeri],
  );
  const paketTalimat = useMemo(
    () =>
      paketSatir
        ? {
            satir_id: paketSatir.satir_id,
            sku: paketSatir.sku ?? "",
            urun_adi: paketSatir.urun_adi,
            personel_id: paketSatir.personel_id,
            personel_adi: paketSatir.personel_adi ?? paketSatir.personel_id,
            not_text: paketSatir.not_text?.trim() ? paketSatir.not_text : null,
          }
        : null,
    [paketSatir],
  );
  const montajTalimat = useMemo(
    () =>
      montajSatir
        ? {
            satir_id: montajSatir.satir_id,
            sku: montajSatir.sku ?? "",
            urun_adi: montajSatir.urun_adi,
            personel_id: montajSatir.personel_id,
            personel_adi: montajSatir.personel_adi ?? montajSatir.personel_id,
            not_text: montajSatir.not_text?.trim() ? montajSatir.not_text : null,
          }
        : null,
    [montajSatir],
  );

  const personelAdi = useMemo(
    () => personeller.find((p) => p.user_id === personelId)?.full_name ?? liste?.satirlar[0]?.personel_adi ?? personelId ?? "",
    [personeller, personelId, liste],
  );

  const yukle = useCallback(async (id: string, sessiz = false) => {
    if (!sessiz) setYukleniyor(true);
    const r = await tabletListeGetir(id);
    if (r.success) {
      setListe(r.data);
      setHata(null);
    } else {
      setHata(r.error);
    }
    if (!sessiz) setYukleniyor(false);
  }, []);

  const personelSec = (id: string) => {
    setPersonelId(id);
    setPickerAcik(false);
    setListe(null);
    router.replace(`/uretim/talimatlarim?personel=${encodeURIComponent(id)}`);
    void yukle(id);
  };

  // Canlı güncelleme: plan/satır/yayın/onay ve üretim kayıtları değişince listeyi tazele
  const idRef = useRef(personelId);
  idRef.current = personelId;
  useEffect(() => {
    const supabase = createClient();
    let t: ReturnType<typeof setTimeout> | null = null;
    const tetikle = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        if (idRef.current) void yukle(idRef.current, true);
      }, 500);
    };
    let kanal = supabase.channel("talimatlarim");
    for (const table of ["talimat_satirlar", "talimat_planlar", "talimat_yayinlar", "talimat_onaylar", "talimat_guncellik", "montaj_sessions", "pack_events", "cut_batches"]) {
      kanal = kanal.on("postgres_changes", { event: "*", schema: DB_SCHEMA, table }, tetikle);
    }
    kanal.subscribe();
    return () => {
      if (t) clearTimeout(t);
      supabase.removeChannel(kanal);
    };
  }, [yukle]);

  const onayla = async () => {
    if (!liste || !personelId || liste.bekleyen_yayin_idler.length === 0) return;
    setOnayda(true);
    const r = await talimatOnayla(liste.bekleyen_yayin_idler[0], personelId);
    if (r.success) {
      toast.success("Teşekkürler, değişiklikler onaylandı");
      await yukle(personelId, true);
    } else {
      toast.error(r.error);
    }
    setOnayda(false);
  };

  const kesimBitirdi = async (s: TalimatSatir) => {
    setKesimYukleniyor(s.satir_id);
    const r = await kesimBitirdiVerisiGetir(s.satir_id);
    setKesimYukleniyor(null);
    if (!r.success) return toast.error(r.error);
    if (!r.data) return toast.error("Satır bulunamadı");
    if (!r.data.plaka_id) return toast.error("Bu satırda plaka tanımlı değil");
    if (!r.data.sku) return toast.error("Plakanın ürünü bulunamadı");
    setKesimVeri(r.data);
  };

  const satirlar = (liste?.satirlar ?? []).filter((s) => !s.etkin_pasif);
  const guncelMi = liste?.guncel.guncel_mi ?? false;
  const bekleyenOnay = (liste?.bekleyen_yayin_idler.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      {/* Başlık + personel */}
      <div className="flex items-center gap-3">
        <Button variant="outline" className="h-12 w-12 shrink-0 p-0" onClick={() => router.back()} aria-label="Geri">
          <ArrowLeft className="size-6" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-vw-dark">
            <ClipboardList className="size-6 shrink-0" />
            İş Talimatları
          </h1>
          <p className="truncate text-lg font-semibold text-vw-deep">{personelAdi || "Çalışan seçin"}</p>
        </div>
        <Button variant="outline" className="h-12 shrink-0 px-4 text-base" onClick={() => setPickerAcik(true)}>
          <Users className="mr-2 size-5" />
          Çalışan değiştir
        </Button>
      </div>

      {personelId && liste && (
        <div
          className={cn(
            "rounded-xl px-4 py-3 text-base font-semibold",
            guncelMi ? "bg-[#70c1aa]/25 text-[#1f6b57]" : "bg-[#ee7683]/25 text-[#a0303d]",
          )}
        >
          {guncelMi ? `Liste güncel — ${tarihTr(liste.guncel.bitis)}'e kadar` : "Liste güncel değil"}
        </div>
      )}

      {bekleyenOnay && (
        <Button
          onClick={onayla}
          disabled={onayda}
          className="h-16 w-full bg-[#f28a19] text-lg font-bold text-white hover:bg-[#d97a10]"
        >
          {onayda ? <Loader2 className="mr-2 size-6 animate-spin" /> : <CheckCheck className="mr-2 size-6" />}
          Değişiklikleri gördüm, anlaşıldı
        </Button>
      )}

      {hata && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{hata}</p>}

      {!personelId ? (
        <p className="py-12 text-center text-muted-foreground">Listeyi görmek için çalışan seçin.</p>
      ) : yukleniyor || !liste ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> Yükleniyor...
        </div>
      ) : satirlar.length === 0 ? (
        <p className="py-12 text-center text-lg text-muted-foreground">
          {liste.plan ? "Bu hafta için iş talimatı yok." : "Yayında iş talimatı listesi yok."}
        </p>
      ) : (
        <ul className="space-y-3">
          {satirlar.map((s) => {
            const yuzde = ilerlemeYuzdesi(s);
            const bitti = s.etkin_durum === "tamamlandi";
            const kesim = s.etkin_istasyon === "kesim";
            return (
              <li
                key={s.satir_id}
                className={cn(
                  "rounded-xl border-2 bg-card p-4 shadow-sm",
                  s.kirmizi ? "border-[#ee7683] bg-[#ee7683]/10" : "border-border",
                  bitti && "opacity-50",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-vw-primary text-xl font-bold text-white">
                    {s.sira}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-lg font-bold leading-tight", s.kirmizi && "text-[#b3202f]")}>
                      {s.sku ?? s.plaka_id ?? "—"}
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 align-middle text-xs font-medium text-muted-foreground">
                        {TALIMAT_ISTASYON_LABEL[s.etkin_istasyon]}
                      </span>
                    </p>
                    <p className={cn("text-base", s.kirmizi ? "text-[#b3202f]" : "text-muted-foreground")}>
                      {s.urun_adi ?? ""}
                      {kesim && s.plaka_adi ? ` · Plaka: ${s.plaka_adi}` : ""}
                    </p>
                    {s.kirmizi && <p className="text-sm font-semibold text-[#b3202f]">Değişti</p>}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Rakam etiket="İstenen" deger={s.istenen_miktar ?? "—"} />
                  <Rakam etiket="Üretilen" deger={s.uretilen} />
                  <Rakam etiket="Fark" deger={s.fark ?? "—"} vurgu={(s.fark ?? 0) > 0} />
                </div>

                {yuzde !== null && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", bitti ? "bg-[#3caa35]" : "bg-[#8d9d70]")}
                        style={{ width: `${yuzde}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-sm font-semibold tabular-nums">%{yuzde}</span>
                  </div>
                )}

                {s.not_text?.trim() && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-base text-amber-900">
                    <StickyNote className="mt-0.5 size-5 shrink-0" />
                    <span className="whitespace-pre-wrap">{s.not_text}</span>
                  </div>
                )}

                {!bitti && (
                  <div className="mt-3">
                    {kesim ? (
                      <Button
                        className="h-14 w-full bg-vw-primary text-lg font-bold text-white hover:bg-vw-deep"
                        disabled={kesimYukleniyor === s.satir_id}
                        onClick={() => kesimBitirdi(s)}
                      >
                        {kesimYukleniyor === s.satir_id ? (
                          <Loader2 className="mr-2 size-5 animate-spin" />
                        ) : (
                          <Scissors className="mr-2 size-5" />
                        )}
                        Bitirdi
                      </Button>
                    ) : (
                      <Button
                        className="h-14 w-full bg-vw-primary text-lg font-bold text-white hover:bg-vw-deep"
                        onClick={() => (s.etkin_istasyon === "paketleme" ? setPaketSatir(s) : setMontajSatir(s))}
                      >
                        <Play className="mr-2 size-5" />
                        Seans Başlat
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Çalışan seçici */}
      <PersonelSecici
        acik={pickerAcik}
        onAcikDegisti={setPickerAcik}
        personeller={personeller}
        seciliId={personelId}
        onSec={personelSec}
        zorunlu={personelId === null}
      />

      {/* Montaj: Seans Başlat */}
      {montajTalimat && (
        <MontajSeansDialog
          open
          onOpenChange={(o) => !o && setMontajSatir(null)}
          talimat={montajTalimat}
          onSuccess={() => router.push("/uretim/montaj")}
        />
      )}

      {/* Paketleme: Seans Başlat */}
      {paketTalimat && (
        <PaketlemeSeansDialog
          open
          onOpenChange={(o) => !o && setPaketSatir(null)}
          talimat={paketTalimat}
          onSuccess={() => router.push("/uretim/paketleme")}
        />
      )}

      {/* Kesim: Bitirdi -> Yeni Kesim (plaka + adet dolu) */}
      {kesimTalimat && (
        <YeniKesimDialog
          open
          onOpenChange={(o) => !o && setKesimVeri(null)}
          talimat={kesimTalimat}
          onSuccess={() => {
            if (personelId) void yukle(personelId, true);
          }}
        />
      )}
    </div>
  );
}

function Rakam({ etiket, deger, vurgu }: { etiket: string; deger: number | string; vurgu?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/60 py-2">
      <p className="text-xs text-muted-foreground">{etiket}</p>
      <p className={cn("text-2xl font-bold tabular-nums", vurgu && "text-[#c26a0c]")}>{deger}</p>
    </div>
  );
}

function normalize(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .trim();
}

function PersonelSecici({
  acik, onAcikDegisti, personeller, seciliId, onSec, zorunlu,
}: {
  acik: boolean;
  onAcikDegisti: (a: boolean) => void;
  personeller: TabletPersonel[];
  seciliId: string | null;
  onSec: (id: string) => void;
  zorunlu: boolean;
}) {
  const [arama, setArama] = useState("");
  const filtreli = useMemo(() => {
    const q = normalize(arama);
    return q ? personeller.filter((p) => normalize(p.full_name).includes(q) || normalize(p.user_id).includes(q)) : personeller;
  }, [personeller, arama]);

  return (
    <Dialog open={acik} onOpenChange={(o) => (zorunlu && !o ? undefined : onAcikDegisti(o))}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(85vh,40rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 max-sm:h-[100dvh] max-sm:w-screen max-sm:max-w-none max-sm:rounded-none"
      >
        <DialogHeader className="shrink-0 flex-row items-center gap-2 space-y-0 border-b px-4 py-3">
          <DialogTitle className="flex-1 text-lg">Çalışan seç</DialogTitle>
          {!zorunlu && (
            <Button variant="ghost" size="icon" className="size-12" onClick={() => onAcikDegisti(false)} aria-label="Kapat">
              <X className="size-6" />
            </Button>
          )}
        </DialogHeader>
        <div className="relative shrink-0 border-b p-3">
          <Search className="absolute left-6 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="İsim ara..."
            className="h-14 pl-11 text-lg"
            autoComplete="off"
          />
        </div>
        <ul className="min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain">
          {filtreli.map((p) => (
            <li key={p.user_id}>
              <button
                type="button"
                onClick={() => onSec(p.user_id)}
                className={cn(
                  "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left text-lg active:bg-muted",
                  p.user_id === seciliId && "bg-vw-primary/15 font-bold",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{p.full_name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{p.user_id}</span>
              </button>
            </li>
          ))}
          {filtreli.length === 0 && <li className="py-10 text-center text-muted-foreground">Çalışan bulunamadı</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

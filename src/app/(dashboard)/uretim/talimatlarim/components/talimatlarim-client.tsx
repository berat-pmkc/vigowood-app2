"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCheck, ClipboardList, Loader2, PauseCircle, PlusCircle, StickyNote, Wrench, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { DB_SCHEMA } from "@/lib/supabase/schema";
import { tabletHatListeGetir, talimatOnaylaHat } from "@/lib/talimat/hat-actions";
import { hatDomId, hatRengi } from "@/lib/talimat/tablet-hat";
import type { TabletHatSatir, TabletHatSeans, TalimatTabletHat, TalimatTabletHatListe } from "@/lib/talimat/types";
import { NewSessionDialog as MontajSeansDialog } from "../../montaj/components/new-session-dialog";
import { NewSessionDialog as PaketlemeSeansDialog } from "../../paketleme/components/new-session-dialog";
import { CloseSessionDialog as MontajKapatDialog } from "../../montaj/components/close-session-dialog";
import { CloseSessionDialog as PaketlemeKapatDialog } from "../../paketleme/components/close-session-dialog";
import type { ActiveMontajSession } from "../../montaj/components/session-card";
import type { ActiveSession } from "../../paketleme/components/session-card";
import { toggleMontajBeklet } from "../../montaj/actions";
import { toggleDuraklat } from "../../paketleme/actions";
import { sesHazirla } from "@/components/shared/talimat/ses";
import { AcikSeansKarti } from "./acik-seans-karti";
import { SeansAcDialog, SeansIslemiDialog, SeansKapatListeDialog } from "./hat-seans-dialogs";

function tarihTr(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

interface Props {
  /** ?hat= : bu hatta kaydır ve vurgula */
  odakHatId: string | null;
  /** Montaj / paketleme ekranından gelindiyse o türün hatları odaklanır (tüm hatlar yine görünür) */
  odakIstasyon: "montaj" | "paketleme" | null;
  baslangicListe: TalimatTabletHatListe | null;
  baslangicHata: string | null;
}

type Islem = { hatId: string; satirId: string; mod: "sec" | "ac" | "kapat" };

export function TalimatlarimClient({ odakHatId, odakIstasyon, baslangicListe, baslangicHata }: Props) {
  const router = useRouter();
  const [liste, setListe] = useState<TalimatTabletHatListe | null>(baslangicListe);
  const [hata, setHata] = useState<string | null>(baslangicHata);
  const [onaydaId, setOnaydaId] = useState<string | null>(null);
  const [islem, setIslem] = useState<Islem | null>(null);
  const [montajKapat, setMontajKapat] = useState<ActiveMontajSession | null>(null);
  const [paketKapat, setPaketKapat] = useState<ActiveSession | null>(null);
  /** Hat bazlı ek seans: önce hat sabit, ürün + çalışan serbest */
  const [ekHatId, setEkHatId] = useState<string | null>(null);

  useEffect(() => {
    sesHazirla();
  }, []);

  const yukle = useCallback(async () => {
    const r = await tabletHatListeGetir();
    if (r.success) {
      setListe(r.data);
      setHata(null);
    } else {
      setHata(r.error);
    }
  }, []);

  // Canlı güncelleme: hatlar, plan/satır/yayın/onay ve üretim kayıtları
  useEffect(() => {
    const supabase = createClient();
    let t: ReturnType<typeof setTimeout> | null = null;
    const tetikle = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => void yukle(), 500);
    };
    let kanal = supabase.channel("talimatlarim-hat");
    for (const table of [
      "talimat_hatlar", "talimat_satirlar", "talimat_planlar", "talimat_yayinlar", "talimat_onaylar",
      "talimat_guncellik", "montaj_sessions", "pack_events",
    ]) {
      kanal = kanal.on("postgres_changes", { event: "*", schema: DB_SCHEMA, table }, tetikle);
    }
    kanal.subscribe();
    return () => {
      if (t) clearTimeout(t);
      supabase.removeChannel(kanal);
    };
  }, [yukle]);

  const hatlar = liste?.hatlar ?? [];

  // Odaklanan hatlar
  const odakIdleri = useMemo(() => {
    const s = new Set<string>();
    if (odakHatId) s.add(odakHatId);
    else if (odakIstasyon) for (const h of hatlar) if (h.hat.tur === odakIstasyon) s.add(h.hat.hat_id);
    return s;
  }, [odakHatId, odakIstasyon, hatlar]);

  const kaydirildi = useRef(false);
  useEffect(() => {
    if (kaydirildi.current || !liste || odakIdleri.size === 0) return;
    const ilk = hatlar.find((h) => odakIdleri.has(h.hat.hat_id));
    if (!ilk) return;
    kaydirildi.current = true;
    const el = document.getElementById(hatDomId(ilk.hat.hat_id));
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start", inline: "start" }));
  }, [liste, odakIdleri, hatlar]);

  const atla = (hatId: string) => {
    document.getElementById(hatDomId(hatId))?.scrollIntoView({ behavior: "smooth", block: "start", inline: "start" });
  };

  const onayla = async (h: TalimatTabletHat) => {
    const yayinId = h.bekleyen_yayin_idler[0];
    if (!yayinId) return;
    setOnaydaId(h.hat.hat_id);
    const r = await talimatOnaylaHat(yayinId, h.hat.hat_id);
    if (r.success) {
      toast.success(`${h.hat.ad}: değişiklikler onaylandı`);
      await yukle();
    } else {
      toast.error(r.error);
    }
    setOnaydaId(null);
  };

  const beklet = async (s: TabletHatSeans) => {
    const beklemede = !!s.duraklatma_baslangic;
    const r = s.tur === "montaj" ? await toggleMontajBeklet(s.session_id) : await toggleDuraklat(s.session_id);
    if (r.success) {
      toast.success(beklemede ? "Seans devam ediyor" : s.tur === "montaj" ? "Seans beklemeye alındı" : "Seans duraklatıldı");
      await yukle();
    } else {
      toast.error(r.error);
    }
  };

  const seansKapatAc = (s: TabletHatSeans) => {
    // Liste penceresini kapat, kapatma penceresini aç
    setIslem(null);
    if (s.tur === "montaj") {
      setMontajKapat({
        session_id: s.session_id,
        sku: s.sku ?? "",
        urun_adi: s.urun_adi ?? undefined,
        step_id: s.step_id ?? "",
        step_name: s.step_name,
        seq_no: s.seq_no,
        is_final_step: s.is_final_step,
        start_time: s.start_time,
        durum: s.durum,
        operator_name: s.operator_name,
        workers: s.workers,
        duraklama_dk: s.duraklama_dk,
        duraklatma_baslangic: s.duraklatma_baslangic,
        yardimci_sayisi: s.yardimci_sayisi,
        hat_id: s.hat_id,
      });
    } else {
      setPaketKapat({
        session_id: s.session_id,
        sku: s.sku,
        urun_adi: s.urun_adi ?? undefined,
        start_time: s.start_time,
        durum: s.durum,
        operator_name: s.operator_name,
        duraklama_dk: s.duraklama_dk,
        duraklatma_baslangic: s.duraklatma_baslangic,
        workers: s.workers,
        yardimci_sayisi: s.yardimci_sayisi,
        hat_id: s.hat_id,
      });
    }
  };

  // Açık işlem penceresi için güncel satır/hat (liste yenilenince canlı kalır)
  const islemHat = islem ? (hatlar.find((h) => h.hat.hat_id === islem.hatId) ?? null) : null;
  const islemSatir: TabletHatSatir | null =
    islem && islemHat ? ([...islemHat.aktif, ...islemHat.tamamlanan].find((s) => s.satir_id === islem.satirId) ?? null) : null;
  const ekHat = ekHatId ? (hatlar.find((h) => h.hat.hat_id === ekHatId)?.hat ?? null) : null;

  const guncelMi = liste?.guncel.guncel_mi ?? false;

  return (
    <div className="mx-auto w-full max-w-[120rem] space-y-4 pb-24">
      {/* Başlık */}
      <div className="flex items-center gap-3">
        <Button variant="outline" className="h-12 w-12 shrink-0 p-0" onClick={() => router.back()} aria-label="Geri">
          <ArrowLeft className="size-6" />
        </Button>
        <h1 className="flex min-w-0 flex-1 items-center gap-2 text-2xl font-bold text-vw-dark sm:text-3xl">
          <ClipboardList className="size-7 shrink-0" />
          İş Talimatları
        </h1>
      </div>

      {liste?.plan && (
        <div
          className={cn(
            "rounded-xl px-4 py-3 text-lg font-semibold",
            guncelMi ? "bg-[#70c1aa]/25 text-[#1f6b57]" : "bg-[#ee7683]/25 text-[#a0303d]",
          )}
        >
          {guncelMi ? `Liste güncel — ${tarihTr(liste.guncel.bitis)}'e kadar` : "Liste güncel değil"}
        </div>
      )}

      {/* Hat sekmeleri (yapışkan): hatta atla */}
      {hatlar.length > 0 && (
        <nav className="sticky top-0 z-20 -mx-1 flex gap-2 overflow-x-auto bg-background/95 px-1 py-2 backdrop-blur">
          {hatlar.map((h) => {
            const bekleyen = h.bekleyen_yayin_idler.length > 0;
            return (
              <button
                key={h.hat.hat_id}
                type="button"
                onClick={() => atla(h.hat.hat_id)}
                className={cn(
                  "flex min-h-12 shrink-0 items-center gap-2 rounded-full border-2 px-4 text-base font-bold active:opacity-80",
                  bekleyen ? "animate-pulse border-[#f28a19] bg-[#f28a19]/15" : "border-transparent text-white",
                  h.pasif && "opacity-60",
                )}
                style={bekleyen ? undefined : { backgroundColor: hatRengi(h.hat) }}
              >
                {h.hat.ad.replace(/\s*HATTI$/i, "")}
                <span className="rounded-full bg-black/20 px-2 py-0.5 text-sm tabular-nums">{h.aktif.length}</span>
              </button>
            );
          })}
        </nav>
      )}

      {hata && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{hata}</p>}

      {!liste ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> Yükleniyor...
        </div>
      ) : hatlar.length === 0 ? (
        <p className="py-12 text-center text-lg text-muted-foreground">
          {liste.plan ? "Bu hafta için hat tanımlı değil." : "Yayında iş talimatı listesi yok."}
        </p>
      ) : (
        // Geniş ekran (>=1024px): hatlar yan yana sütun, sığmazsa yatay kaydırma. Dar ekran: alt alta.
        <div
          // Geniş ekranda tüm hatlar ekran genişliğine eşit sütunlar halinde sığar (yatay kaydırma yok)
          className="space-y-8 lg:grid lg:items-start lg:gap-3 lg:space-y-0 lg:pb-4"
          style={{ gridTemplateColumns: `repeat(${Math.max(hatlar.length, 1)}, minmax(0, 1fr))` }}
        >
          {hatlar.map((h) => (
            <HatBolumu
              key={h.hat.hat_id}
              h={h}
              odak={odakIdleri.has(h.hat.hat_id)}
              onaylaniyor={onaydaId === h.hat.hat_id}
              onOnayla={() => onayla(h)}
              onSeansIslemi={(s) => setIslem({ hatId: h.hat.hat_id, satirId: s.satir_id, mod: "sec" })}
              onEkSeans={() => setEkHatId(h.hat.hat_id)}
              onBeklet={beklet}
              onKapat={seansKapatAc}
            />
          ))}
        </div>
      )}

      {/* Seans işlemi: Seans Aç / Seans Kapat */}
      <SeansIslemiDialog
        satir={islemSatir}
        hat={islemHat?.hat ?? null}
        open={islem?.mod === "sec"}
        onClose={() => setIslem(null)}
        onAc={() => islem && setIslem({ ...islem, mod: "ac" })}
        onKapat={() => islem && setIslem({ ...islem, mod: "kapat" })}
      />
      <SeansAcDialog
        satir={islemSatir}
        hat={islemHat?.hat ?? null}
        open={islem?.mod === "ac"}
        onClose={() => setIslem(null)}
        onSuccess={() => {
          setIslem(null);
          void yukle();
        }}
      />
      <SeansKapatListeDialog
        satir={islemSatir}
        hat={islemHat?.hat ?? null}
        open={islem?.mod === "kapat"}
        onClose={() => setIslem(null)}
        onBeklet={beklet}
        onKapat={seansKapatAc}
      />

      {/* Ek seans (hat sabit, ürün serbest) */}
      {ekHat?.tur === "montaj" && (
        <MontajSeansDialog
          open
          onOpenChange={(o) => !o && setEkHatId(null)}
          hat={{ hat_id: ekHat.hat_id, hat_adi: ekHat.ad }}
          onSuccess={() => {
            setEkHatId(null);
            void yukle();
          }}
        />
      )}
      {ekHat?.tur === "paketleme" && (
        <PaketlemeSeansDialog
          open
          onOpenChange={(o) => !o && setEkHatId(null)}
          hat={{ hat_id: ekHat.hat_id, hat_adi: ekHat.ad }}
          onSuccess={() => {
            setEkHatId(null);
            void yukle();
          }}
        />
      )}

      {/* Seansı kapat (montaj / paketleme) — kapanınca liste tazelenir */}
      <MontajKapatDialog
        session={montajKapat}
        open={montajKapat !== null}
        onOpenChange={(o) => {
          if (!o) {
            setMontajKapat(null);
            void yukle();
          }
        }}
      />
      <PaketlemeKapatDialog
        session={paketKapat}
        open={paketKapat !== null}
        onOpenChange={(o) => {
          if (!o) {
            setPaketKapat(null);
            void yukle();
          }
        }}
      />
    </div>
  );
}

function HatBolumu({
  h, odak, onaylaniyor, onOnayla, onSeansIslemi, onEkSeans, onBeklet, onKapat,
}: {
  h: TalimatTabletHat;
  odak: boolean;
  onaylaniyor: boolean;
  onOnayla: () => void;
  onSeansIslemi: (s: TabletHatSatir) => void;
  onEkSeans: () => void;
  onBeklet: (s: TabletHatSeans) => Promise<void>;
  onKapat: (s: TabletHatSeans) => void;
}) {
  const renk = hatRengi(h.hat);
  const bekleyen = h.bekleyen_yayin_idler.length > 0;
  // Tamamlanan satırlarda hâlâ açık seans varsa kapatılabilsin
  const bitenAcik = h.tamamlanan.filter((s) => s.acik_seanslar.length > 0);
  const ekAcik = h.diger_acik_seanslar;
  const ekBitenler = h.ek_seanslar.filter((e) => e.durum === "tamamlandi");

  return (
    <section
      id={hatDomId(h.hat.hat_id)}
      className={cn(
        "scroll-mt-16 rounded-2xl min-w-0",
        odak && "ring-4 ring-offset-2",
      )}
      style={odak ? ({ "--tw-ring-color": renk } as React.CSSProperties) : undefined}
    >
      <div className="rounded-xl px-3 py-2.5 text-white shadow-sm" style={{ backgroundColor: renk }}>
        <div className="flex items-center gap-2">
          {h.hat.tur === "montaj" ? <Wrench className="size-5 shrink-0" /> : <Package className="size-5 shrink-0" />}
          <h2 className="min-w-0 flex-1 text-base font-extrabold leading-tight" title={`${h.hat.ad} iş talimatları`}>
            {h.hat.ad}
          </h2>
          <span className="shrink-0 rounded-full bg-white/25 px-3 py-1 text-base font-bold">{h.aktif.length} iş</span>
        </div>
        {bekleyen && (
          <Button
            onClick={onOnayla}
            disabled={onaylaniyor}
            className="mt-3 h-14 w-full bg-[#f28a19] text-lg font-bold text-white hover:bg-[#d97a10]"
          >
            {onaylaniyor ? <Loader2 className="mr-2 size-5 animate-spin" /> : <CheckCheck className="mr-2 size-6" />}
            Gördüm, anlaşıldı
          </Button>
        )}
      </div>

      {h.pasif ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl border-2 border-dashed bg-muted/60 p-5 text-lg font-semibold text-muted-foreground">
          <PauseCircle className="size-7 shrink-0" />
          Bu hat bugün pasif — iş yok
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {h.aktif.map((s, i) => (
            <SatirKarti key={s.satir_id} s={s} no={i + 1} renk={renk} onSeansIslemi={() => onSeansIslemi(s)} />
          ))}
          {h.aktif.length === 0 && (
            <li className="rounded-xl border-2 border-dashed p-5 text-center text-lg text-muted-foreground">
              Bekleyen iş yok
            </li>
          )}
        </ul>
      )}

      {bitenAcik.length > 0 && (
        <div className="mt-3 space-y-2 rounded-xl border-2 border-dashed border-[#3caa35]/60 p-3">
          <p className="text-base font-bold text-[#2f8a2a]">Tamamlanan iş — açık seans var</p>
          {bitenAcik.map((s) => (
            <div key={s.satir_id} className="space-y-1">
              <p className="truncate text-base font-semibold">{s.urun_adi ?? s.sku}</p>
              {s.acik_seanslar.map((x) => (
                <AcikSeansKarti key={x.session_id} x={x} onBeklet={onBeklet} onKapat={onKapat} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Ek seans */}
      <Button
        variant="outline"
        className="mt-4 h-14 w-full border-2 border-[#f28a19] text-lg font-bold text-[#c26a0c] hover:bg-[#f28a19]/10"
        onClick={onEkSeans}
      >
        <PlusCircle className="mr-2 size-6" />
        Ek Seans Aç
      </Button>

      {ekAcik.length > 0 && (
        <div className="mt-3 space-y-2 rounded-xl border-2 border-dashed border-[#f28a19]/60 p-3">
          <p className="text-base font-bold text-[#c26a0c]">Ek seanslar (açık)</p>
          {ekAcik.map((x) => (
            <AcikSeansKarti
              key={x.session_id}
              x={x}
              baslik={`${x.urun_adi ?? x.sku ?? ""}${x.sku && x.urun_adi ? ` (${x.sku})` : ""}`}
              onBeklet={onBeklet}
              onKapat={onKapat}
            />
          ))}
        </div>
      )}

      {ekBitenler.length > 0 && (
        <details className="mt-3 rounded-xl border bg-card px-3 py-2">
          <summary className="min-h-10 cursor-pointer py-1 text-base font-semibold text-muted-foreground">
            Bugünkü ek seanslar ({ekBitenler.length})
          </summary>
          <ul className="mt-2 divide-y text-base">
            {ekBitenler.map((e) => (
              <li key={e.session_id} className="flex flex-wrap items-center gap-x-3 py-2">
                <span className="min-w-0 flex-1 truncate font-medium">{e.urun_adi ?? e.sku}</span>
                <span className="tabular-nums text-muted-foreground">{e.qty} adet</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {h.tamamlanan.length > 0 && (
        <details className="mt-3 rounded-xl border bg-card px-3 py-2">
          <summary className="min-h-12 cursor-pointer py-2 text-lg font-bold text-muted-foreground">
            Tamamlananlar ({h.tamamlanan.length})
          </summary>
          <ul className="mt-2 divide-y">
            {h.tamamlanan.map((s) => {
              const istenen = s.istenen_miktar ?? 0;
              const fazla = s.uretilen - istenen;
              return (
                <li key={s.satir_id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold">{s.urun_adi ?? s.sku}</span>
                    <span className="block text-sm text-muted-foreground">{s.sku}</span>
                  </span>
                  <span className="text-right text-base tabular-nums">
                    <span className="text-muted-foreground">İstenen </span>
                    <strong>{s.istenen_miktar ?? "—"}</strong>
                    <span className="text-muted-foreground"> · Üretilen </span>
                    <strong>{s.uretilen}</strong>
                    {fazla > 0 && s.istenen_miktar != null && (
                      <span className="ml-2 rounded bg-[#f28a19]/20 px-1.5 py-0.5 text-sm font-bold text-[#c26a0c]">
                        +{fazla}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
}

function SatirKarti({
  s, no, renk, onSeansIslemi,
}: {
  s: TabletHatSatir;
  no: number;
  renk: string;
  onSeansIslemi: () => void;
}) {
  const acik = s.acik_seanslar.length;
  const istenen = s.istenen_miktar;
  return (
    <li
      className={cn(
        "rounded-lg border bg-card px-2.5 py-1.5 shadow-sm",
        s.kirmizi ? "border-[#ee7683] bg-[#ee7683]/10" : "border-border",
      )}
      style={s.kirmizi ? undefined : { borderLeftColor: renk, borderLeftWidth: 4 }}
    >
      {/* Üst satır: sıra · ürün adı / kod */}
      <div className="flex items-center gap-2">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white"
          style={{ backgroundColor: renk }}
        >
          {no}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("line-clamp-1 text-sm font-bold leading-snug", s.kirmizi && "text-[#b3202f]")}>
            {s.urun_adi ?? s.sku ?? "—"}
          </p>
          <p className="text-[11px] leading-tight text-muted-foreground">
            {s.sku}
            {s.kirmizi && <span className="ml-2 font-bold text-[#b3202f]">Değişti</span>}
          </p>
        </div>
      </div>

      {s.not_text?.trim() && (
        <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">
          <StickyNote className="mt-px size-3.5 shrink-0" />
          <span className="whitespace-pre-wrap">{s.not_text}</span>
        </div>
      )}

      {/* Alt satır: istenen / üretilen + seans işlemi */}
      <div className="mt-1.5 flex items-stretch gap-1.5">
        <Rakam etiket="İstenen" deger={istenen != null ? istenen : "—"} />
        <Rakam etiket="Üretilen" deger={s.uretilen} vurgu />
        <Button
          className="h-auto min-h-10 min-w-0 flex-1 flex-col gap-0 whitespace-normal px-1.5 py-1 text-xs font-bold leading-tight text-white hover:opacity-90 xl:text-sm"
          style={{ backgroundColor: renk }}
          onClick={onSeansIslemi}
        >
          Seans işlemi
          {acik > 0 && (
            <span className="rounded-full bg-white px-1.5 text-[10px] font-bold leading-4" style={{ color: renk }}>
              {acik} açık
            </span>
          )}
        </Button>
      </div>
    </li>
  );
}

function Rakam({ etiket, deger, vurgu }: { etiket: string; deger: number | string; vurgu?: boolean }) {
  return (
    <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-md bg-muted/60 py-0.5 xl:w-14">
      <p className="text-[10px] leading-tight text-muted-foreground">{etiket}</p>
      <p className={cn("text-base font-extrabold leading-tight tabular-nums", vurgu && "text-vw-deep")}>{deger}</p>
    </div>
  );
}

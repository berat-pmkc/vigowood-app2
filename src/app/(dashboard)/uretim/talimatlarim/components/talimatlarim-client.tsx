"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCheck, ClipboardList, Clock, Loader2, Package, Pause, Play, Scissors, Search,
  PlusCircle, StickyNote, Wrench, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { DB_SCHEMA } from "@/lib/supabase/schema";
import { tabletTumListeGetir, talimatOnayla } from "@/lib/talimat/actions";
import { kesimBitirdiVerisiGetir, type KesimBitirdiVerisi } from "@/lib/talimat/tablet-actions";
import { TALIMAT_ISTASYON_LABEL } from "@/lib/talimat/constants";
import { ilerlemeYuzdesi, istasyonEsle } from "@/lib/talimat/helpers";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TabletAcikSeans, TalimatSatir, TalimatTabletTum } from "@/lib/talimat/types";
import { NewSessionDialog as MontajSeansDialog } from "../../montaj/components/new-session-dialog";
import { NewSessionDialog as PaketlemeSeansDialog } from "../../paketleme/components/new-session-dialog";
import { CloseSessionDialog as MontajKapatDialog } from "../../montaj/components/close-session-dialog";
import { CloseSessionDialog as PaketlemeKapatDialog } from "../../paketleme/components/close-session-dialog";
import type { ActiveMontajSession } from "../../montaj/components/session-card";
import type { ActiveSession } from "../../paketleme/components/session-card";
import { toggleMontajBeklet } from "../../montaj/actions";
import { toggleDuraklat } from "../../paketleme/actions";
import { YeniKesimDialog } from "../../kesim/components/yeni-kesim-dialog";
import { sesHazirla } from "@/components/shared/talimat/ses";

function tarihTr(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function normalize(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .trim();
}

const ISTASYON_AD: Record<string, string> = { kesim: "Kesim", montaj: "Montaj", paketleme: "Paketleme" };

/** Satırın bölümü: atanan istasyon, yoksa türetilmiş (plaka → kesim, aksi halde montaj) */
function satirIstasyonu(s: { istasyon: string | null; etkin_istasyon: string | null }): string | null {
  return s.istasyon ?? s.etkin_istasyon ?? null;
}

function istasyonTaban(s: string | null | undefined): string {
  return normalize((s ?? "").replace(/\s+Hattı$/i, ""));
}

interface Props {
  /** Vurgulanan çalışan (URL ?personel= ya da seçili operatör) */
  seciliPersonelId: string | null;
  /** Oturum açan hesabın istasyonu (ortak istasyon tableti) */
  istasyon: string | null;
  /** Montaj / paketleme / kesim ekranından gelindiyse sadece o bölümün işleri */
  varsayilanIstasyon: string | null;
  baslangicListe: TalimatTabletTum | null;
  baslangicHata: string | null;
}

interface Grup {
  personel_id: string;
  ad: string;
  istasyon: string | null;
  satirlar: TalimatSatir[];
}

export function TalimatlarimClient({ seciliPersonelId, istasyon, varsayilanIstasyon, baslangicListe, baslangicHata }: Props) {
  const router = useRouter();
  const [liste, setListe] = useState<TalimatTabletTum | null>(baslangicListe);
  const [hata, setHata] = useState<string | null>(baslangicHata);
  const [onaydaId, setOnaydaId] = useState<string | null>(null);
  const [arama, setArama] = useState("");
  const [istasyonFiltre, setIstasyonFiltre] = useState<string>(varsayilanIstasyon ?? "tumu");

  // Seans / kesim diyalogları
  const [montajSatir, setMontajSatir] = useState<TalimatSatir | null>(null);
  const [paketSatir, setPaketSatir] = useState<TalimatSatir | null>(null);
  const [kesimVeri, setKesimVeri] = useState<KesimBitirdiVerisi | null>(null);
  const [kesimYukleniyor, setKesimYukleniyor] = useState<string | null>(null);
  const [montajKapat, setMontajKapat] = useState<ActiveMontajSession | null>(null);
  const [paketKapat, setPaketKapat] = useState<ActiveSession | null>(null);

  // Ek seans (plan dışı): önce Montaj/Paketleme seçimi, sonra ilgili seans diyaloğu
  type EkKisi = { personel_id: string; personel_adi: string; istasyon: string | null };
  const [ekSecim, setEkSecim] = useState<EkKisi | null>(null);
  const [ekMontaj, setEkMontaj] = useState<EkKisi | null>(null);
  const [ekPaket, setEkPaket] = useState<EkKisi | null>(null);

  useEffect(() => {
    sesHazirla();
  }, []);

  // Kararlı nesneler: diyalog açıkken liste yenilense de form sıfırlanmasın
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

  const yukle = useCallback(async () => {
    const r = await tabletTumListeGetir(seciliPersonelId);
    if (r.success) {
      setListe(r.data);
      setHata(null);
    } else {
      setHata(r.error);
    }
  }, [seciliPersonelId]);

  // Canlı güncelleme: plan/satır/yayın/onay ve üretim kayıtları (montaj/paketleme seansları dahil)
  useEffect(() => {
    const supabase = createClient();
    let t: ReturnType<typeof setTimeout> | null = null;
    const tetikle = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => void yukle(), 500);
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

  const onayla = async (personelId: string, yayinId: string) => {
    setOnaydaId(personelId);
    const r = await talimatOnayla(yayinId, personelId);
    if (r.success) {
      toast.success("Teşekkürler, değişiklikler onaylandı");
      await yukle();
    } else {
      toast.error(r.error);
    }
    setOnaydaId(null);
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

  const beklet = async (s: TabletAcikSeans) => {
    const beklemede = !!s.duraklatma_baslangic;
    const r = s.tur === "montaj" ? await toggleMontajBeklet(s.session_id) : await toggleDuraklat(s.session_id);
    if (r.success) {
      toast.success(beklemede ? "Seans devam ediyor" : s.tur === "montaj" ? "Seans beklemeye alındı" : "Seans duraklatıldı");
      await yukle();
    } else {
      toast.error(r.error);
    }
  };

  const seansKapatAc = (s: TabletAcikSeans) => {
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
      });
    }
  };

  // Seanslar satıra göre gruplanır
  const seansMap = useMemo(() => {
    const m = new Map<string, TabletAcikSeans[]>();
    for (const s of liste?.acik_seanslar ?? []) {
      if (s.ek_seans) continue;
      const a = m.get(s.satir_id) ?? [];
      a.push(s);
      m.set(s.satir_id, a);
    }
    return m;
  }, [liste]);

  // Ek seanslar personele göre
  const ekMap = useMemo(() => {
    const m = new Map<string, TabletAcikSeans[]>();
    for (const s of liste?.acik_seanslar ?? []) {
      if (!s.ek_seans || !s.personel_id) continue;
      const a = m.get(s.personel_id) ?? [];
      a.push(s);
      m.set(s.personel_id, a);
    }
    return m;
  }, [liste]);

  // Çalışan grupları: vurgulanan çalışan, sonra aynı istasyon, sonra alfabetik
  const tumGruplar = useMemo<Grup[]>(() => {
    const m = new Map<string, Grup>();
    for (const s of liste?.satirlar ?? []) {
      let g = m.get(s.personel_id);
      if (!g) {
        g = { personel_id: s.personel_id, ad: s.personel_adi ?? s.personel_id, istasyon: s.personel_istasyon, satirlar: [] };
        m.set(s.personel_id, g);
      }
      g.satirlar.push(s);
    }
    const benimIst = istasyon ? istasyonTaban(istasyon) : null;
    const rank = (g: Grup) =>
      g.personel_id === seciliPersonelId ? 0 : benimIst && istasyonTaban(g.istasyon) === benimIst ? 1 : 2;
    return [...m.values()].sort((a, b) => rank(a) - rank(b) || a.ad.localeCompare(b.ad, "tr"));
  }, [liste, seciliPersonelId, istasyon]);

  const istasyonlar = useMemo(() => {
    const set = new Map<string, string>();
    for (const g of tumGruplar) {
      for (const s of g.satirlar) {
        const k = satirIstasyonu(s);
        if (k) set.set(k, ISTASYON_AD[k] ?? k);
      }
    }
    return [...set.entries()].sort((a, b) => a[1].localeCompare(b[1], "tr"));
  }, [tumGruplar]);

  const gruplar = useMemo(() => {
    const q = normalize(arama);
    // İstasyon filtresi satır bazında: montaj ekranından gelen yalnızca montaj işlerini görür
    return tumGruplar
      .map((g) =>
        istasyonFiltre === "tumu" ? g : { ...g, satirlar: g.satirlar.filter((s) => satirIstasyonu(s) === istasyonFiltre) },
      )
      .filter((g) => {
        if (g.satirlar.length === 0) return false;
        return !q || normalize(g.ad).includes(q) || normalize(g.personel_id).includes(q);
      });
  }, [tumGruplar, arama, istasyonFiltre]);

  // ?personel= / seçili operatör: ilk yüklemede o çalışanın bölümüne kaydır (en üstteyse gerek yok)
  const kaydirildi = useRef(false);
  useEffect(() => {
    if (kaydirildi.current || !seciliPersonelId || !liste) return;
    kaydirildi.current = true;
    const el = document.getElementById(`p-${seciliPersonelId}`);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [seciliPersonelId, liste]);

  const atla = (id: string) => {
    document.getElementById(`p-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const guncelMi = liste?.guncel.guncel_mi ?? false;

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      {/* Başlık */}
      <div className="flex items-center gap-3">
        <Button variant="outline" className="h-12 w-12 shrink-0 p-0" onClick={() => router.back()} aria-label="Geri">
          <ArrowLeft className="size-6" />
        </Button>
        <h1 className="flex min-w-0 flex-1 items-center gap-2 text-2xl font-bold text-vw-dark">
          <ClipboardList className="size-6 shrink-0" />
          İş Talimatları
        </h1>
      </div>

      {liste?.plan && (
        <div
          className={cn(
            "rounded-xl px-4 py-3 text-base font-semibold",
            guncelMi ? "bg-[#70c1aa]/25 text-[#1f6b57]" : "bg-[#ee7683]/25 text-[#a0303d]",
          )}
        >
          {guncelMi ? `Liste güncel — ${tarihTr(liste.guncel.bitis)}'e kadar` : "Liste güncel değil"}
        </div>
      )}

      {/* Arama + hızlı atlama */}
      {liste && tumGruplar.length > 0 && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="Adını yaz / filtrele"
              className="h-14 pl-12 pr-12 text-lg"
              autoComplete="off"
            />
            {arama && (
              <button
                type="button"
                onClick={() => setArama("")}
                className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
                aria-label="Temizle"
              >
                <X className="size-5" />
              </button>
            )}
          </div>

          {istasyonlar.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Chip aktif={istasyonFiltre === "tumu"} onClick={() => setIstasyonFiltre("tumu")}>
                Tümü
              </Chip>
              {istasyonlar.map(([key, ad]) => (
                <Chip key={key} aktif={istasyonFiltre === key} onClick={() => setIstasyonFiltre(key)}>
                  {ad}
                </Chip>
              ))}
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pb-1">
            {gruplar.map((g) => (
              <button
                key={g.personel_id}
                type="button"
                onClick={() => atla(g.personel_id)}
                className={cn(
                  "min-h-12 shrink-0 rounded-full border-2 px-4 text-base font-medium active:bg-muted",
                  g.personel_id === seciliPersonelId
                    ? "border-vw-primary bg-vw-primary/20 font-bold"
                    : (liste?.bekleyen[g.personel_id]?.length ?? 0) > 0
                      ? "border-[#f28a19] bg-[#f28a19]/10"
                      : "border-border bg-card",
                )}
              >
                {g.ad}
              </button>
            ))}
            {gruplar.length === 0 && <span className="py-3 text-sm text-muted-foreground">Eşleşen çalışan yok</span>}
          </div>
        </div>
      )}

      {hata && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{hata}</p>}

      {!liste ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> Yükleniyor...
        </div>
      ) : tumGruplar.length === 0 ? (
        <p className="py-12 text-center text-lg text-muted-foreground">
          {liste.plan ? "Bu hafta için iş talimatı yok." : "Yayında iş talimatı listesi yok."}
        </p>
      ) : (
        <div className="space-y-6">
          {gruplar.map((g) => {
            const benim = g.personel_id === seciliPersonelId;
            const bekleyen = liste.bekleyen[g.personel_id] ?? [];
            return (
              <section
                key={g.personel_id}
                id={`p-${g.personel_id}`}
                className={cn("scroll-mt-2 rounded-2xl", benim && "ring-2 ring-vw-primary ring-offset-2")}
              >
                <div
                  className={cn(
                    "sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl px-4 py-3 shadow-sm",
                    benim ? "bg-vw-primary text-white" : "bg-vw-dark text-white",
                  )}
                >
                  <h2 className="min-w-0 flex-1 truncate text-xl font-bold">{g.ad}</h2>
                  {benim && <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-semibold">Sen</span>}
                  <span className="text-sm opacity-80">{g.satirlar.length} iş</span>
                  {bekleyen.length > 0 && (
                    <Button
                      onClick={() => onayla(g.personel_id, bekleyen[0])}
                      disabled={onaydaId === g.personel_id}
                      className="h-12 w-full bg-[#f28a19] text-base font-bold text-white hover:bg-[#d97a10] sm:w-auto"
                    >
                      {onaydaId === g.personel_id ? (
                        <Loader2 className="mr-2 size-5 animate-spin" />
                      ) : (
                        <CheckCheck className="mr-2 size-5" />
                      )}
                      Değişiklikleri gördüm, anlaşıldı
                    </Button>
                  )}
                </div>

                <Button
                  variant="outline"
                  className="mt-3 h-12 w-full border-2 border-[#f28a19] text-base font-bold text-[#c26a0c] hover:bg-[#f28a19]/10"
                  onClick={() => setEkSecim({ personel_id: g.personel_id, personel_adi: g.ad, istasyon: g.istasyon })}
                >
                  <PlusCircle className="mr-2 size-5" />
                  Ek Seans Aç
                </Button>

                {(ekMap.get(g.personel_id)?.length ?? 0) > 0 && (
                  <div className="mt-3 space-y-2 rounded-xl border-2 border-dashed border-[#f28a19]/60 p-3">
                    <p className="text-sm font-bold text-[#c26a0c]">Ek seanslar</p>
                    {ekMap.get(g.personel_id)!.map((x) => (
                      <div key={x.session_id} className="space-y-1">
                        <p className="truncate text-sm font-semibold">
                          {x.sku}
                          <span className="ml-2 font-normal text-muted-foreground">{x.urun_adi ?? ""}</span>
                        </p>
                        <AcikSeansKarti x={x} onBeklet={beklet} onKapat={seansKapatAc} />
                      </div>
                    ))}
                  </div>
                )}

                <ul className="mt-3 space-y-3">
                  {g.satirlar.map((s) => (
                    <SatirKarti
                      key={s.satir_id}
                      s={s}
                      seanslar={seansMap.get(s.satir_id) ?? []}
                      kesimYukleniyor={kesimYukleniyor === s.satir_id}
                      onKesim={() => kesimBitirdi(s)}
                      onMontaj={() => setMontajSatir(s)}
                      onPaket={() => setPaketSatir(s)}
                      onBeklet={beklet}
                      onKapat={seansKapatAc}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
          {gruplar.length === 0 && (
            <p className="py-10 text-center text-lg text-muted-foreground">Çalışan bulunamadı</p>
          )}
        </div>
      )}

      {/* Ek Seans: Montaj / Paketleme seçimi */}
      <Dialog open={ekSecim !== null} onOpenChange={(o) => !o && setEkSecim(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ek Seans — {ekSecim?.personel_adi}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Plan dışı gelen ürün için seans türünü seç.</p>
          <div className="grid gap-3">
            {(["montaj", "paketleme"] as const).map((t) => {
              const varsayilan = ekSecim ? istasyonEsle(ekSecim.istasyon) === t : false;
              return (
                <Button
                  key={t}
                  variant={varsayilan ? "default" : "outline"}
                  className={cn("h-16 text-lg font-bold", varsayilan && "bg-vw-primary text-white hover:bg-vw-deep")}
                  onClick={() => {
                    if (!ekSecim) return;
                    if (t === "montaj") setEkMontaj(ekSecim);
                    else setEkPaket(ekSecim);
                    setEkSecim(null);
                  }}
                >
                  {t === "montaj" ? <Wrench className="mr-2 size-6" /> : <Package className="mr-2 size-6" />}
                  {t === "montaj" ? "Montaj" : "Paketleme"}
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {ekMontaj && (
        <MontajSeansDialog
          open
          onOpenChange={(o) => !o && setEkMontaj(null)}
          ekSeans={{ personel_id: ekMontaj.personel_id, personel_adi: ekMontaj.personel_adi }}
          onSuccess={() => {
            setEkMontaj(null);
            void yukle();
          }}
        />
      )}
      {ekPaket && (
        <PaketlemeSeansDialog
          open
          onOpenChange={(o) => !o && setEkPaket(null)}
          ekSeans={{ personel_id: ekPaket.personel_id, personel_adi: ekPaket.personel_adi }}
          onSuccess={() => {
            setEkPaket(null);
            void yukle();
          }}
        />
      )}

      {/* Montaj: Seans Başlat */}
      {montajTalimat && (
        <MontajSeansDialog
          open
          onOpenChange={(o) => !o && setMontajSatir(null)}
          talimat={montajTalimat}
          onSuccess={() => {
            setMontajSatir(null);
            void yukle();
          }}
        />
      )}

      {/* Paketleme: Seans Başlat */}
      {paketTalimat && (
        <PaketlemeSeansDialog
          open
          onOpenChange={(o) => !o && setPaketSatir(null)}
          talimat={paketTalimat}
          onSuccess={() => {
            setPaketSatir(null);
            void yukle();
          }}
        />
      )}

      {/* Seansı Kapat (montaj / paketleme) — kapanınca liste tazelenir */}
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

      {/* Kesim: Bitirdi -> Yeni Kesim (plaka + adet dolu) */}
      {kesimTalimat && (
        <YeniKesimDialog
          open
          onOpenChange={(o) => !o && setKesimVeri(null)}
          talimat={kesimTalimat}
          onSuccess={() => void yukle()}
        />
      )}
    </div>
  );
}

function Chip({ aktif, onClick, children }: { aktif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-12 shrink-0 rounded-lg border-2 px-5 text-base font-semibold active:opacity-80",
        aktif ? "border-vw-deep bg-vw-deep text-white" : "border-border bg-card",
      )}
    >
      {children}
    </button>
  );
}

function SatirKarti({
  s, seanslar, kesimYukleniyor, onKesim, onMontaj, onPaket, onBeklet, onKapat,
}: {
  s: TalimatSatir;
  seanslar: TabletAcikSeans[];
  kesimYukleniyor: boolean;
  onKesim: () => void;
  onMontaj: () => void;
  onPaket: () => void;
  onBeklet: (s: TabletAcikSeans) => Promise<void>;
  onKapat: (s: TabletAcikSeans) => void;
}) {
  const yuzde = ilerlemeYuzdesi(s);
  const bitti = s.etkin_durum === "tamamlandi";
  const kesim = s.etkin_istasyon === "kesim";
  const acikVar = seanslar.length > 0;

  return (
    <li
      className={cn(
        "rounded-xl border-2 bg-card p-4 shadow-sm",
        s.kirmizi ? "border-[#ee7683] bg-[#ee7683]/10" : "border-border",
        bitti && !acikVar && "opacity-50",
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

      {/* Bu satıra bağlı açık seanslar: buradan beklet / kapat */}
      {acikVar && (
        <div className="mt-3 space-y-2">
          {seanslar.map((x) => (
            <AcikSeansKarti key={x.session_id} x={x} onBeklet={onBeklet} onKapat={onKapat} />
          ))}
        </div>
      )}

      {!bitti && (
        <div className="mt-3">
          {kesim ? (
            <Button
              className="h-14 w-full bg-vw-primary text-lg font-bold text-white hover:bg-vw-deep"
              disabled={kesimYukleniyor}
              onClick={onKesim}
            >
              {kesimYukleniyor ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Scissors className="mr-2 size-5" />}
              Bitirdi
            </Button>
          ) : (
            <Button
              className="h-14 w-full bg-vw-primary text-lg font-bold text-white hover:bg-vw-deep"
              onClick={s.etkin_istasyon === "paketleme" ? onPaket : onMontaj}
            >
              <Play className="mr-2 size-5" />
              {acikVar ? "Açık seans var — Yeni Seans Başlat" : "Seans Başlat"}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function dkFormat(dakika: number) {
  const t = Math.max(0, Math.floor(dakika));
  const h = Math.floor(t / 60);
  const m = t % 60;
  return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
}

function AcikSeansKarti({
  x, onBeklet, onKapat,
}: {
  x: TabletAcikSeans;
  onBeklet: (s: TabletAcikSeans) => Promise<void>;
  onKapat: (s: TabletAcikSeans) => void;
}) {
  const [, tick] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(false);
  const beklemede = !!x.duraklatma_baslangic;
  const montaj = x.tur === "montaj";

  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const net = x.start_time
    ? (now - new Date(x.start_time).getTime()) / 60000 -
      Number(x.duraklama_dk ?? 0) -
      (x.duraklatma_baslangic ? (now - new Date(x.duraklatma_baslangic).getTime()) / 60000 : 0)
    : 0;

  return (
    <div
      className={cn(
        "rounded-lg border-2 p-3",
        beklemede ? "border-amber-300 bg-amber-50" : "border-blue-200 bg-blue-50/60",
      )}
    >
      <div className="flex items-center gap-2">
        {montaj ? <Wrench className="size-5 shrink-0 text-blue-700" /> : <Package className="size-5 shrink-0 text-blue-700" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">
            {montaj ? `${x.seq_no ?? ""}. ${x.step_name ?? "Montaj"}` : "Paketleme"}
            {x.is_final_step && <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">Son</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {x.operator_name ?? ""}
            {(x.yardimci_sayisi ?? 0) > 0 && ` +${x.yardimci_sayisi} yardımcı`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Clock className={cn("size-5", beklemede ? "text-amber-600" : "text-blue-600")} />
          <span className={cn("text-xl font-bold tabular-nums", beklemede ? "text-amber-700" : "text-blue-700")}>
            {x.start_time ? dkFormat(net) : "—"}
          </span>
        </div>
      </div>
      {beklemede && (
        <p className="mt-1 text-sm font-semibold text-amber-700">
          <Pause className="mr-1 inline size-4" />
          {montaj ? "Beklemede" : "Duraklatıldı"}
        </p>
      )}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          disabled={yukleniyor}
          className={cn(
            "h-14 text-base font-semibold",
            beklemede ? "border-emerald-400 text-emerald-700" : "border-amber-400 text-amber-700",
          )}
          onClick={async () => {
            setYukleniyor(true);
            try {
              await onBeklet(x);
            } finally {
              setYukleniyor(false);
            }
          }}
        >
          {yukleniyor ? (
            <Loader2 className="mr-2 size-5 animate-spin" />
          ) : beklemede ? (
            <Play className="mr-2 size-5" />
          ) : (
            <Pause className="mr-2 size-5" />
          )}
          {beklemede ? "Devam Et" : montaj ? "Beklet" : "Duraklat"}
        </Button>
        <Button
          className="h-14 bg-vw-success text-base font-bold text-white hover:bg-vw-success/90"
          onClick={() => onKapat(x)}
        >
          {montaj ? <Wrench className="mr-2 size-5" /> : <Package className="mr-2 size-5" />}
          Seansı Kapat
        </Button>
      </div>
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

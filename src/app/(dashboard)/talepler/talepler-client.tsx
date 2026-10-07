"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  History,
  ListPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Undo2,
  Warehouse,
  XCircle,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import {
  talepDetayGetir,
  talepGeriCek,
  talepKaldir,
  talepKaldirToplu,
  talepKapat,
  talepSil,
  talepStoktaMevcut,
  talepYenidenAc,
} from "@/lib/talep/actions";
import { TALEP_DURUM_COLOR, TALEP_DURUM_LABEL } from "@/lib/talimat/constants";
import { talepSerbestMi } from "@/lib/talimat/helpers";
import type { TalepBaglanti } from "@/lib/talimat/admin-actions";
import type { Depo, TalimatPersonel } from "@/lib/talimat/types";
import type { Talep, TalepDurum, TalepRevizyon } from "@/lib/talep/types";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { TalepFormDialog } from "./talep-form-dialog";
import { TalimataAtaDialog } from "./talimata-ata-dialog";

export type TalepSekme = "aktif" | "tamamlanan" | "tamamlanmayan";

interface Props {
  sekme: TalepSekme;
  talepler: Talep[];
  toplam: number;
  baglantilar: TalepBaglanti[];
  depolar: Depo[];
  personeller: TalimatPersonel[];
  userId: string;
  planner: boolean;
  baslangic: string;
  bitis: string;
  /** Derin bağlantı (?talep=<id>): satıra kaydır + vurgula */
  vurgu: string | null;
  /** ?degisiklik=1: son revizyon farkını satır altında aç */
  degisiklikGoster: boolean;
}

const SEKMELER: Array<{ key: TalepSekme; label: string }> = [
  { key: "aktif", label: "Aktif Talepler" },
  { key: "tamamlanan", label: "Tamamlanan Talepler" },
  { key: "tamamlanmayan", label: "Tamamlanmayan Talepler" },
];

type ChipKey = "tumu" | "kapali" | TalepDurum;

const CHIPS: Array<{ key: ChipKey; label: string }> = [
  { key: "tumu", label: "Tümü" },
  { key: "acik", label: "Açık" },
  { key: "is_emri_verildi", label: "İş emri verilenler" },
  { key: "hazirlaniyor", label: "Hazırlığı başlayanlar" },
  { key: "hazir", label: "Hazır" },
  { key: "pasif", label: "Pasif" },
  { key: "kapali", label: "Kapananlar" },
];

type NedenIslem = { tip: "geri_cek" | "tamamlanmadi" | "stokta_mevcut"; talep: Talep };

const NEDEN_METIN: Record<NedenIslem["tip"], { baslik: string; aciklama: string; buton: string }> = {
  geri_cek: { baslik: "Talebi geri çek", aciklama: "Bağlı iş talimatı satırları pasife alınır.", buton: "Geri çek" },
  tamamlanmadi: { baslik: "Tamamlanmadı olarak kapat", aciklama: "Bağlı iş talimatı satırları pasife alınır.", buton: "Kapat" },
  stokta_mevcut: { baslik: "Stokta mevcut", aciklama: "Talep kapatılır, bağlı iş talimatı satırları pasife alınır.", buton: "Stokta mevcut" },
};

const ALAN_ETIKET: Record<string, string> = {
  sku: "Ürün",
  hedef_depo_id: "Hedef depo",
  istenen_miktar: "İstenen miktar",
  termin_tarihi: "Termin",
  aciklama: "Açıklama",
  kapanis: "Kapanış",
};

const ISLEM_ETIKET: Record<string, string> = {
  guncelle: "Düzenleme",
  geri_cek: "Geri çekme",
  kapat: "Kapatma",
  stokta_mevcut: "Stokta mevcut",
  yeniden_ac: "Yeniden açma",
};

export function TaleplerClient({
  sekme,
  talepler,
  toplam,
  baglantilar,
  depolar,
  personeller,
  userId,
  planner,
  baslangic,
  bitis,
  vurgu,
  degisiklikGoster,
}: Props) {
  const router = useRouter();
  const yenile = useCallback(() => router.refresh(), [router]);

  useRealtimeSubscription({
    channelName: "talepler-sayfasi",
    subscriptions: [
      { event: "*", table: "talepler" },
      { event: "*", table: "talimat_satirlar" },
    ],
    debounceMs: 1200,
  });

  // ── filtreler ──
  const [arama, setArama] = useState("");
  const [chip, setChip] = useState<ChipKey>("tumu");
  const [fNo, setFNo] = useState("");
  const [fEden, setFEden] = useState("");
  const [fUrun, setFUrun] = useState("");
  const [fDepo, setFDepo] = useState("");
  const [fAciklama, setFAciklama] = useState("");
  const [tBas, setTBas] = useState(baslangic);
  const [tBit, setTBit] = useState(bitis);
  const [filtreAcik, setFiltreAcik] = useState(false);

  const baglantiMap = useMemo(() => new Map(baglantilar.map((b) => [b.talep_id, b])), [baglantilar]);
  const depoAd = useMemo(() => new Map(depolar.map((d) => [d.depo_id, d.ad])), [depolar]);

  const sayilar = useMemo(() => {
    const m: Record<string, number> = { tumu: talepler.length, kapali: 0 };
    for (const t of talepler) {
      m[t.durum] = (m[t.durum] ?? 0) + 1;
      if (t.kapanis) m.kapali++;
    }
    return m;
  }, [talepler]);

  const edenler = useMemo(
    () => [...new Set(talepler.map((t) => t.olusturan_adi ?? t.olusturan))].sort((a, b) => a.localeCompare(b, "tr")),
    [talepler],
  );

  const gorunenMi = useCallback(
    (t: Talep) => {
      const no = fNo.trim().replace("#", "");
      const u = fUrun.trim().toLocaleLowerCase("tr");
      const a = fAciklama.trim().toLocaleLowerCase("tr");
      const q = arama.trim().toLocaleLowerCase("tr");
      if (sekme === "aktif" && chip !== "tumu") {
        if (chip === "kapali" ? !t.kapanis : t.durum !== chip) return false;
      }
      if (no && !String(t.talep_no).includes(no)) return false;
      if (fEden && (t.olusturan_adi ?? t.olusturan) !== fEden) return false;
      if (u && !`${t.sku} ${t.urun_adi ?? ""}`.toLocaleLowerCase("tr").includes(u)) return false;
      if (fDepo && t.hedef_depo_id !== fDepo) return false;
      if (a && !(t.aciklama ?? "").toLocaleLowerCase("tr").includes(a)) return false;
      if (q) {
        const hay = `#${t.talep_no} ${t.sku} ${t.urun_adi ?? ""} ${t.aciklama ?? ""} ${t.olusturan_adi ?? t.olusturan}`.toLocaleLowerCase("tr");
        if (!hay.includes(q)) return false;
      }
      return true;
    },
    [chip, fNo, fEden, fUrun, fDepo, fAciklama, arama, sekme],
  );

  /** Açık/devam eden talepler yeni -> eski; kapalı ("Kaldır"a basılmamış) talepler soluk olarak EN ALTTA */
  const gorunen = useMemo(() => {
    const liste = talepler.filter((t) => gorunenMi(t));
    if (sekme !== "aktif") return liste;
    const acik = liste.filter((t) => !t.kapanis).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const kapali = liste
      .filter((t) => !!t.kapanis)
      .sort((a, b) => (b.kapanis_at ?? b.updated_at).localeCompare(a.kapanis_at ?? a.updated_at));
    return [...acik, ...kapali];
  }, [talepler, gorunenMi, sekme]);

  const filtreSayisi =
    [fNo, fEden, fUrun, fDepo, fAciklama].filter((x) => x.trim()).length + (sekme !== "aktif" && (baslangic || bitis) ? 1 : 0);
  const herhangiFiltre = filtreSayisi > 0 || !!arama.trim() || chip !== "tumu";

  const filtreleriTemizle = useCallback(() => {
    setArama("");
    setChip("tumu");
    setFNo("");
    setFEden("");
    setFUrun("");
    setFDepo("");
    setFAciklama("");
  }, []);

  // ── seçim (toplu kaldır) ──
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const kaldirilabilir = useCallback(
    (t: Talep) => !!t.kapanis && !t.kaldirildi_at && (t.olusturan === userId || planner),
    [userId, planner],
  );
  const kaldirilabilirler = useMemo(() => gorunen.filter(kaldirilabilir), [gorunen, kaldirilabilir]);
  // listeden düşen/kaldırılan talepler seçimden otomatik çıkar
  const seciliIds = useMemo(() => {
    const gecerli = new Set(talepler.filter(kaldirilabilir).map((t) => t.talep_id));
    return [...secili].filter((id) => gecerli.has(id));
  }, [secili, talepler, kaldirilabilir]);

  const kaldir = async (ids: string[]) => {
    if (ids.length === 0) return;
    const r = ids.length === 1 ? await talepKaldir(ids[0]) : await talepKaldirToplu(ids);
    if (!r.success) return void toast.error(r.error);
    toast.success(ids.length === 1 ? "Talep listeden kaldırıldı" : `${ids.length} talep listeden kaldırıldı`);
    setSecili(new Set());
    yenile();
  };

  // ── revizyon farkı (satır altında) ──
  const [diffAcik, setDiffAcik] = useState<Set<string>>(new Set());
  const [revizyonlar, setRevizyonlar] = useState<Record<string, TalepRevizyon[] | "yukleniyor" | "hata">>({});
  const revizyonYukle = useCallback(async (id: string) => {
    setRevizyonlar((p) => ({ ...p, [id]: "yukleniyor" }));
    const r = await talepDetayGetir(id);
    setRevizyonlar((p) => ({ ...p, [id]: r.success ? r.data.revizyonlar : "hata" }));
  }, []);
  const diffToggle = useCallback(
    (id: string) => {
      const acik = diffAcik.has(id);
      setDiffAcik((p) => {
        const n = new Set(p);
        if (acik) n.delete(id);
        else n.add(id);
        return n;
      });
      if (!acik) void revizyonYukle(id);
    },
    [diffAcik, revizyonYukle],
  );

  // ── derin bağlantı: filtre temizle, satıra kaydır, 3 sn vurgula ──
  const [parlayan, setParlayan] = useState<string | null>(null);
  const islenenAnahtar = useRef<string | null>(null);
  const filtreTemizlendi = useRef<string | null>(null);
  useEffect(() => {
    if (!vurgu) return;
    const anahtar = `${vurgu}|${degisiklikGoster ? 1 : 0}`;
    if (islenenAnahtar.current === anahtar) return;
    const hedef = talepler.find((t) => t.talep_id === vurgu);
    if (!hedef) return;
    if (!gorunenMi(hedef)) {
      if (filtreTemizlendi.current !== vurgu) {
        filtreTemizlendi.current = vurgu;
        filtreleriTemizle();
        toast.info("Filtreler temizlendi");
      }
      return;
    }
    islenenAnahtar.current = anahtar;
    if (degisiklikGoster) {
      setDiffAcik((p) => new Set(p).add(vurgu));
      void revizyonYukle(vurgu);
    }
    setTimeout(() => {
      document.getElementById(`talep-${vurgu}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      setParlayan(vurgu);
      setTimeout(() => setParlayan((p) => (p === vurgu ? null : p)), 3000);
    }, 150);
  }, [vurgu, degisiklikGoster, talepler, gorunenMi, filtreleriTemizle, revizyonYukle]);

  // ── diyaloglar ──
  const [formAcik, setFormAcik] = useState(false);
  const [duzenle, setDuzenle] = useState<Talep | null>(null);
  const [ataTalep, setAtaTalep] = useState<Talep | null>(null);
  const [silTalep, setSilTalep] = useState<Talep | null>(null);
  const [nedenIslem, setNedenIslem] = useState<NedenIslem | null>(null);
  const [neden, setNeden] = useState("");

  const sekmeHref = (s: TalepSekme) => (s === "aktif" ? "/talepler" : `/talepler?sekme=${s}`);

  const tarihUygula = () => {
    const qs = new URLSearchParams({ sekme });
    if (tBas) qs.set("baslangic", tBas);
    if (tBit) qs.set("bitis", tBit);
    setFiltreAcik(false);
    router.push(`/talepler?${qs.toString()}`);
  };

  const nedenOnayla = async () => {
    if (!nedenIslem) return;
    const { tip, talep } = nedenIslem;
    const n = neden.trim() || null;
    const r =
      tip === "geri_cek"
        ? await talepGeriCek(talep.talep_id, n)
        : tip === "tamamlanmadi"
          ? await talepKapat(talep.talep_id, "tamamlanmadi", n)
          : await talepStoktaMevcut(talep.talep_id, n);
    if (!r.success) return void toast.error(r.error);
    toast.success("İşlem tamamlandı");
    setNedenIslem(null);
    setNeden("");
    yenile();
  };

  const bugun = new Date().toLocaleDateString("sv-SE");
  const ilkKapaliId = sekme === "aktif" ? gorunen.find((t) => !!t.kapanis)?.talep_id : undefined;
  const acikVarKapaliVar = gorunen.some((t) => !t.kapanis) && !!ilkKapaliId;

  const degerMetni = (alan: string, v: unknown): string => {
    if (v == null || v === "") return "—";
    if (alan === "hedef_depo_id") return depoAd.get(String(v)) ?? String(v);
    if (alan === "termin_tarihi") return formatDate(String(v));
    if (alan === "istenen_miktar") return formatNumber(Number(v));
    if (alan === "kapanis") return TALEP_DURUM_LABEL[String(v)] ?? String(v);
    return String(v);
  };

  return (
    <div className="space-y-3">
      {/* Başlık: büyük ana buton solda, ikincil işlemler sağda küçük */}
      <div className="flex flex-wrap items-center gap-4">
        <Button
          size="lg"
          className="h-12 gap-2 bg-vw-deep px-6 text-base font-semibold text-white shadow-sm hover:bg-vw-dark"
          onClick={() => {
            setDuzenle(null);
            setFormAcik(true);
          }}
        >
          <Plus className="h-5 w-5" /> Yeni Talep
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-vw-dark">Talepler</h1>
          <p className="text-sm text-muted-foreground">
            Üretim talepleri — en yeni üstte; kapananlar &quot;Kaldır&quot; denene dek altta soluk kalır
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {seciliIds.length > 0 && (
            <Button size="sm" variant="outline" className="border-[#c0424f]/50 text-[#c0424f]" onClick={() => kaldir(seciliIds)}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Seçilenleri kaldır ({seciliIds.length})
            </Button>
          )}
          {planner && (
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link href="/ops/board/mavi-yaka">
                <ClipboardList className="mr-1.5 h-4 w-4" /> Mavi Yaka planı
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Sekmeler + arama + Filtreler */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
          {SEKMELER.map((s) => (
            <Link
              key={s.key}
              href={sekmeHref(s.key)}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                sekme === s.key ? "bg-background text-vw-dark shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative w-56 sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Talep no, ürün, açıklama, kişi ara" className="h-9 pl-8" />
          </div>
          <Button variant="outline" size="sm" className="h-9" onClick={() => setFiltreAcik(true)}>
            <SlidersHorizontal className="mr-1.5 h-4 w-4" /> Filtreler
            {filtreSayisi > 0 && (
              <span className="ml-1.5 rounded-full bg-vw-deep px-1.5 text-[11px] font-semibold text-white">{filtreSayisi}</span>
            )}
          </Button>
          {herhangiFiltre && (
            <Button variant="ghost" size="sm" className="h-9" onClick={filtreleriTemizle}>
              <X className="mr-1 h-4 w-4" /> Temizle
            </Button>
          )}
        </div>
      </div>

      {/* Durum çipleri (kompakt, listeden ayrı) */}
      {sekme === "aktif" ? (
        <div className="mb-4 flex flex-wrap gap-1.5 border-b pb-3">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setChip(c.key)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                chip === c.key ? "border-vw-deep bg-vw-deep text-white" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {c.label} <span className="ml-0.5 tabular-nums opacity-80">{sayilar[c.key] ?? 0}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2 border-b pb-3 text-xs text-muted-foreground">
          {toplam} kayıt
          {(baslangic || bitis) && (
            <span>
              · {baslangic ? formatDate(baslangic) : "…"} – {bitis ? formatDate(bitis) : "…"}
            </span>
          )}
        </div>
      )}

      {/* Tablo (kaydırılabilir kapsayıcı; başlık yapışkan) */}
      <div className="max-h-[calc(100dvh-16rem)] min-h-[320px] overflow-auto rounded-lg border bg-card">
        <table className="w-full min-w-[1250px] border-collapse text-sm">
          <thead className="text-left text-xs font-semibold uppercase tracking-wide text-vw-deep">
            <tr>
              <th className="sticky top-0 z-20 h-9 w-8 bg-vw-light px-2">
                {kaldirilabilirler.length > 0 && sekme === "aktif" && (
                  <Checkbox
                    aria-label="Kapalı talepleri seç"
                    checked={kaldirilabilirler.every((t) => secili.has(t.talep_id))}
                    onCheckedChange={(v) => setSecili(v ? new Set(kaldirilabilirler.map((t) => t.talep_id)) : new Set())}
                  />
                )}
              </th>
              {["Talep No", "Tarih", "Talep Eden", "Ürün", "Depo"].map((h) => (
                <th key={h} className="sticky top-0 z-20 h-9 bg-vw-light px-2">
                  {h}
                </th>
              ))}
              {["Depo Stok", "Toplam Stok", "İstenen", "Üretilen"].map((h) => (
                <th key={h} className="sticky top-0 z-20 h-9 bg-vw-light px-2 text-right">
                  {h}
                </th>
              ))}
              {["Termin", "Durum", "Açıklama", ""].map((h, i) => (
                <th key={i} className="sticky top-0 z-20 h-9 bg-vw-light px-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gorunen.length === 0 && (
              <tr>
                <td colSpan={14} className="py-12 text-center text-sm text-muted-foreground">
                  Talep bulunamadı.
                </td>
              </tr>
            )}
            {gorunen.map((t) => {
              const renk = TALEP_DURUM_COLOR[t.durum] ?? TALEP_DURUM_COLOR.acik;
              const bag = baglantiMap.get(t.talep_id);
              const kapali = !!t.kapanis;
              const benim = t.olusturan === userId;
              const yetkili = benim || planner;
              const serbest = talepSerbestMi(t.created_at);
              const terminGecti = !kapali && !!t.termin_tarihi && t.termin_tarihi < bugun;
              const solukSatir = sekme === "aktif" && kapali;
              const vurgulu = parlayan === t.talep_id;
              const diff = diffAcik.has(t.talep_id);
              const rev = revizyonlar[t.talep_id];
              return (
                <Fragment key={t.talep_id}>
                  {acikVarKapaliVar && t.talep_id === ilkKapaliId && (
                    <tr>
                      <td colSpan={14} className="border-y bg-muted/60 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                        Kapanan talepler — &quot;Kaldır&quot;a basana kadar burada soluk kalır
                      </td>
                    </tr>
                  )}
                  <tr
                    id={`talep-${t.talep_id}`}
                    data-talep-id={t.talep_id}
                    className={cn(
                      "border-b align-top transition-colors",
                      t.durum === "pasif" && "text-[#78909c]",
                      solukSatir && "bg-muted/30 opacity-55",
                      vurgulu && "animate-pulse bg-[#fff59d] opacity-100",
                    )}
                  >
                    <td className="px-2 py-2.5">
                      {solukSatir && kaldirilabilir(t) && (
                        <Checkbox
                          aria-label="Seç"
                          checked={secili.has(t.talep_id)}
                          onCheckedChange={(v) =>
                            setSecili((p) => {
                              const n = new Set(p);
                              if (v) n.add(t.talep_id);
                              else n.delete(t.talep_id);
                              return n;
                            })
                          }
                        />
                      )}
                    </td>
                    <td className="px-2 py-2.5 font-semibold tabular-nums">#{t.talep_no}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 tabular-nums">{formatDate(t.created_at)}</td>
                    <td className="px-2 py-2.5">{t.olusturan_adi ?? t.olusturan}</td>
                    <td className="min-w-[180px] px-2 py-2.5">
                      <div className="font-medium">{t.sku}</div>
                      <div className="text-xs text-muted-foreground">{t.urun_adi}</div>
                    </td>
                    <td className="px-2 py-2.5">{t.depo_adi ?? "—"}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{t.depo_stok != null ? formatNumber(t.depo_stok) : "—"}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{formatNumber(t.toplam_stok)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{t.istenen_miktar != null ? formatNumber(t.istenen_miktar) : "—"}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{t.bagli_satir_sayisi > 0 ? formatNumber(t.uretilen) : "—"}</td>
                    <td className={cn("whitespace-nowrap px-2 py-2.5 tabular-nums", terminGecti && "font-semibold text-[#c0424f]")}>
                      {formatDate(t.termin_tarihi)}
                    </td>
                    <td className="min-w-[130px] px-2 py-2.5">
                      <div className="flex flex-col items-start gap-1">
                        <Badge className="border-0" style={{ background: renk.bg, color: renk.fg }}>
                          {TALEP_DURUM_LABEL[t.durum] ?? t.durum}
                        </Badge>
                        {t.kapanis_neden && <span className="text-[11px] text-muted-foreground">{t.kapanis_neden}</span>}
                        {bag?.kirmizi && (
                          <button
                            type="button"
                            onClick={() => diffToggle(t.talep_id)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#c0424f] hover:underline"
                          >
                            <History className="h-3 w-3" /> Değişikliği {diff ? "gizle" : "gör"}
                          </button>
                        )}
                        {bag && (
                          <Link
                            href={`/ops/board/mavi-yaka?hafta=${bag.hafta_baslangic}&satir=${bag.satir_id}`}
                            className="inline-flex items-center gap-1 text-[11px] text-[#3368b1] hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> Talimatı gör
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="min-w-[160px] max-w-[260px] px-2 py-2.5 text-xs text-muted-foreground">{t.aciklama ?? ""}</td>
                    <td className="whitespace-nowrap px-1 py-2">
                      <div className="flex items-center gap-1">
                        {solukSatir && kaldirilabilir(t) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-[#c0424f]/50 px-2 text-xs text-[#c0424f]"
                            onClick={() => kaldir([t.talep_id])}
                          >
                            Kaldır
                          </Button>
                        )}
                        {yetkili && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="İşlemler">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              {!kapali && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setDuzenle(t);
                                      setFormAcik(true);
                                    }}
                                  >
                                    <Pencil className="mr-2 h-4 w-4" /> Düzenle
                                    {!serbest && <span className="ml-auto text-[10px] text-muted-foreground">kayıtlı</span>}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setNeden("");
                                      setNedenIslem({ tip: "geri_cek", talep: t });
                                    }}
                                  >
                                    <Undo2 className="mr-2 h-4 w-4" /> Geri çek
                                  </DropdownMenuItem>
                                  {t.bagli_satir_sayisi === 0 && (
                                    <DropdownMenuItem className="text-[#c0424f]" onClick={() => setSilTalep(t)}>
                                      <Trash2 className="mr-2 h-4 w-4" /> Sil
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}
                              {planner && !kapali && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setAtaTalep(t)}>
                                    <ListPlus className="mr-2 h-4 w-4" /> İş talimatına ata
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setNeden("");
                                      setNedenIslem({ tip: "stokta_mevcut", talep: t });
                                    }}
                                  >
                                    <Warehouse className="mr-2 h-4 w-4" /> Stokta mevcut
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      const r = await talepKapat(t.talep_id, "tamamlandi");
                                      if (!r.success) toast.error(r.error);
                                      else toast.success("Talep tamamlandı (listede soluk kalır, \"Kaldır\" ile çıkarın)");
                                      yenile();
                                    }}
                                  >
                                    <CheckCircle2 className="mr-2 h-4 w-4 text-[#3caa35]" /> Tamamlandı
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setNeden("");
                                      setNedenIslem({ tip: "tamamlanmadi", talep: t });
                                    }}
                                  >
                                    <XCircle className="mr-2 h-4 w-4 text-[#c0424f]" /> Tamamlanmadı
                                  </DropdownMenuItem>
                                </>
                              )}
                              {kapali && (
                                <DropdownMenuItem
                                  onClick={async () => {
                                    const r = await talepYenidenAc(t.talep_id);
                                    if (!r.success) toast.error(r.error);
                                    else toast.success("Talep yeniden açıldı");
                                    yenile();
                                  }}
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" /> Yeniden aç
                                </DropdownMenuItem>
                              )}
                              {!kapali && benim && !planner && !serbest && (
                                <div className="flex items-center gap-1 px-2 py-1.5 text-[10px] text-muted-foreground">
                                  <CalendarClock className="h-3 w-3" /> 10 dk geçti: değişiklikler kayıt altına alınır
                                </div>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </td>
                  </tr>
                  {diff && (
                    <tr className="border-b bg-[#fff8f0]">
                      <td />
                      <td colSpan={13} className="px-3 py-3">
                        <RevizyonFarki rev={rev} degerMetni={degerMetni} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Filtreler paneli */}
      <Sheet open={filtreAcik} onOpenChange={setFiltreAcik}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Filtreler</SheetTitle>
            <SheetDescription>Listeyi daraltmak için kullanın. Aktif filtre: {filtreSayisi}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
            <div>
              <Label className="text-xs">Talep no</Label>
              <Input value={fNo} onChange={(e) => setFNo(e.target.value)} placeholder="Örn. 124" className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Ürün (kod / ad)</Label>
              <Input value={fUrun} onChange={(e) => setFUrun(e.target.value)} placeholder="Kod veya ad" className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Talep eden</Label>
              <select
                value={fEden}
                onChange={(e) => setFEden(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              >
                <option value="">Tümü</option>
                {edenler.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Depo</Label>
              <select
                value={fDepo}
                onChange={(e) => setFDepo(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              >
                <option value="">Tümü</option>
                {depolar.map((d) => (
                  <option key={d.depo_id} value={d.depo_id}>
                    {d.ad}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Açıklama</Label>
              <Input value={fAciklama} onChange={(e) => setFAciklama(e.target.value)} placeholder="Açıklamada ara" className="h-9" />
            </div>
            {sekme !== "aktif" && (
              <div className="space-y-2 rounded-md border p-3">
                <div className="text-xs font-semibold text-vw-deep">Tarih aralığı (talep açılış)</div>
                <div>
                  <Label className="text-xs">Başlangıç</Label>
                  <Input type="date" value={tBas} onChange={(e) => setTBas(e.target.value)} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Bitiş</Label>
                  <Input type="date" value={tBit} onChange={(e) => setTBit(e.target.value)} className="h-9" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={tarihUygula} className="bg-vw-deep text-white hover:bg-vw-dark">
                    Tarihi uygula
                  </Button>
                  {(baslangic || bitis) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setTBas("");
                        setTBit("");
                        setFiltreAcik(false);
                        router.push(`/talepler?sekme=${sekme}`);
                      }}
                    >
                      Tarihi temizle
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
          <SheetFooter className="flex-row justify-between border-t">
            <Button variant="outline" onClick={filtreleriTemizle}>
              <X className="mr-1 h-4 w-4" /> Temizle
            </Button>
            <Button onClick={() => setFiltreAcik(false)} className="bg-vw-deep text-white hover:bg-vw-dark">
              Listeyi göster ({gorunen.length})
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <TalepFormDialog
        open={formAcik}
        onClose={() => setFormAcik(false)}
        depolar={depolar}
        talep={duzenle}
        planner={planner}
        onDone={yenile}
      />

      <TalimataAtaDialog talep={ataTalep} personeller={personeller} onClose={() => setAtaTalep(null)} onDone={yenile} />

      {/* Neden diyaloğu */}
      <Dialog open={!!nedenIslem} onOpenChange={(o) => !o && setNedenIslem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{nedenIslem && NEDEN_METIN[nedenIslem.tip].baslik}</DialogTitle>
            <DialogDescription>
              {nedenIslem && `#${nedenIslem.talep.talep_no} · ${nedenIslem.talep.sku}. ${NEDEN_METIN[nedenIslem.tip].aciklama}`}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Neden (isteğe bağlı)</Label>
            <Textarea value={neden} onChange={(e) => setNeden(e.target.value)} rows={3} maxLength={500} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNedenIslem(null)}>
              Vazgeç
            </Button>
            <Button onClick={nedenOnayla} className="bg-vw-deep text-white hover:bg-vw-dark">
              {nedenIslem && NEDEN_METIN[nedenIslem.tip].buton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!silTalep} onOpenChange={(o) => !o && setSilTalep(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Talep silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              #{silTalep?.talep_no} · {silTalep?.sku} kalıcı olarak silinecek.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#c0424f] text-white hover:bg-[#a63744]"
              onClick={async () => {
                if (!silTalep) return;
                const r = await talepSil(silTalep.talep_id);
                if (!r.success) toast.error(r.error);
                else toast.success("Talep silindi");
                setSilTalep(null);
                yenile();
              }}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RevizyonFarki({
  rev,
  degerMetni,
}: {
  rev: TalepRevizyon[] | "yukleniyor" | "hata" | undefined;
  degerMetni: (alan: string, v: unknown) => string;
}) {
  if (!rev || rev === "yukleniyor") return <span className="text-xs text-muted-foreground">Yükleniyor...</span>;
  if (rev === "hata") return <span className="text-xs text-[#c0424f]">Değişiklik kaydı yüklenemedi.</span>;
  if (rev.length === 0)
    return <span className="text-xs text-muted-foreground">Kayıtlı değişiklik yok (ilk 10 dakikadaki düzenlemeler kaydedilmez).</span>;
  const son = [...rev].reverse().find((r) => Object.keys(r.degisiklikler ?? {}).length > 0) ?? rev[rev.length - 1];
  const alanlar = Object.entries(son.degisiklikler ?? {});
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold text-[#b8650c]">
        Son değişiklik: {ISLEM_ETIKET[son.islem] ?? son.islem} · {son.yapan_adi ?? son.yapan ?? "—"} ·{" "}
        {new Date(son.created_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
        {son.neden ? ` · ${son.neden}` : ""}
      </div>
      {alanlar.length === 0 ? (
        <div className="text-xs text-muted-foreground">Alan değişikliği yok.</div>
      ) : (
        <table className="text-xs">
          <tbody>
            {alanlar.map(([alan, d]) => (
              <tr key={alan}>
                <td className="pr-4 font-medium text-vw-deep">{ALAN_ETIKET[alan] ?? alan}</td>
                <td className="pr-2 text-muted-foreground line-through">{degerMetni(alan, d.eski)}</td>
                <td className="pr-2">→</td>
                <td className="font-semibold text-[#c0424f]">{degerMetni(alan, d.yeni)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rev.length > 1 && <div className="text-[11px] text-muted-foreground">Toplam {rev.length} kayıtlı revizyon.</div>}
    </div>
  );
}

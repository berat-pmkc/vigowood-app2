"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  EyeOff,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Send,
  SlidersHorizontal,
  Wand2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import {
  guncelIsaretle,
  planGetirVeyaOlustur,
  planKopyala,
  satirKaydet,
  satirSil,
  satirSirala,
  talimatPasifKaldir,
  talimatYayinla,
} from "@/lib/talimat/actions";
import { PLAN_DURUM_LABEL, TALIMAT_ISTASYONLAR } from "@/lib/talimat/constants";
import { gunEkle, istasyonEsle, personeleGoreGrupla, satirBos, satirFiltrele } from "@/lib/talimat/helpers";
import type {
  SatirKaydetGirdi,
  TalimatPersonel,
  TalimatPlan,
  TalimatSatir,
  TalimatSatirFiltre,
  TalimatYayin,
  UrunStokSecenek,
} from "@/lib/talimat/types";
import { cn, formatDate } from "@/lib/utils";
import { PasifDialog, type PasifHedef } from "./pasif-dialog";
import { PersonelEkle } from "./personel-ekle";
import { SatirRow, type SatirIslemleri } from "./satir-row";
import { YayinDialog } from "./yayin-dialog";
import { YayinGecmisi } from "./yayin-gecmisi";

interface Props {
  hafta: string;
  buHafta: string;
  plan: TalimatPlan | null;
  satirlar: TalimatSatir[];
  yayinlar: TalimatYayin[];
  personeller: TalimatPersonel[];
  stoklar: Record<string, UrunStokSecenek["depo_stoklari"]>;
  planner: boolean;
  /** satir_id -> ilk eklenme zamanı (personel grupları: ilk eklenen üstte) */
  eklenme: Record<string, string>;
  /** Derin bağlantı (?satir=<id>): grubu aç, satıra kaydır, 3 sn vurgula */
  vurguSatir: string | null;
}

const PLAN_RENK: Record<string, string> = {
  taslak: "bg-[#fde8cf] text-[#b8650c]",
  yayinda: "bg-[#d4eee5] text-[#2f7d66]",
  pasif: "bg-[#eceff1] text-[#546e7a]",
};

type Toggle = "oncelik1" | "oncelik1Seanssiz" | "degisen" | "onaysiz" | "pasif" | "tamamlanan";

const TOGGLES: Array<{ key: Toggle; label: string }> = [
  { key: "oncelik1", label: "Sadece 1. sıra" },
  { key: "oncelik1Seanssiz", label: "1. sıra, seans açılmamış" },
  { key: "degisen", label: "Değişenler" },
  { key: "onaysiz", label: "Onay bekleyenler" },
  { key: "pasif", label: "Pasifler" },
  { key: "tamamlanan", label: "Tamamlananlar" },
];

function hataMesaji(r: { error: string; code?: string }): string {
  if (r.code === "ARDISIK_SKU") return "Aynı personelde art arda aynı ürün olamaz. Araya başka bir ürün ekleyin.";
  if (r.code === "PLAN_PASIF") return "Pasif plan düzenlenemez.";
  return r.error;
}

export function MaviYakaClient({ hafta, buHafta, plan, satirlar, yayinlar, personeller, stoklar, planner, eklenme, vurguSatir }: Props) {
  const router = useRouter();
  const yenile = useCallback(() => router.refresh(), [router]);

  useRealtimeSubscription({
    channelName: "talimat-mavi-yaka",
    subscriptions: [
      { event: "*", table: "talimat_satirlar" },
      { event: "*", table: "talimat_planlar" },
      { event: "*", table: "talimat_yayinlar" },
      { event: "*", table: "talimat_onaylar" },
      { event: "*", table: "talepler" },
    ],
    debounceMs: 1200,
  });

  const editable = planner && !!plan && plan.durum !== "pasif";
  const gelecekHafta = hafta > buHafta;

  // ── filtreler ──
  const [personelFiltre, setPersonelFiltre] = useState("");
  const [arama, setArama] = useState("");
  const [istasyon, setIstasyon] = useState("");
  const [toggles, setToggles] = useState<Set<Toggle>>(new Set());
  const [personelKumesi, setPersonelKumesi] = useState<string[] | null>(null);

  const toggle = (k: Toggle) =>
    setToggles((p) => {
      const n = new Set(p);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const filtreAktif = !!(personelFiltre || arama || istasyon || toggles.size || personelKumesi);
  const filtreTemizle = () => {
    setPersonelFiltre("");
    setArama("");
    setIstasyon("");
    setToggles(new Set());
    setPersonelKumesi(null);
  };

  // ── iyimser sıralama ──
  const [yerelSira, setYerelSira] = useState<Record<string, string[]>>({});
  useEffect(() => setYerelSira({}), [satirlar]);

  const tumGrup = useMemo(() => personeleGoreGrupla(satirlar), [satirlar]);

  const gorunenSatirlar = useMemo(() => {
    const f: TalimatSatirFiltre = {
      personelId: personelFiltre || undefined,
      istasyon: (istasyon || undefined) as TalimatSatirFiltre["istasyon"],
      sadeceOncelik1: toggles.has("oncelik1"),
      oncelik1SeansBaslamamis: toggles.has("oncelik1Seanssiz"),
      sadeceDegisen: toggles.has("degisen"),
      sadeceOnaylamayan: toggles.has("onaysiz"),
      sadecePasif: toggles.has("pasif"),
      sadeceTamamlanan: toggles.has("tamamlanan"),
    };
    let liste = satirFiltrele(satirlar, f);
    if (personelKumesi) liste = liste.filter((s) => personelKumesi.includes(s.personel_id));
    const q = arama.trim().toLocaleLowerCase("tr");
    if (q) {
      liste = liste.filter((s) =>
        `${s.sku ?? ""} ${s.urun_adi ?? ""} ${s.personel_adi ?? ""} ${s.plaka_adi ?? ""}`.toLocaleLowerCase("tr").includes(q),
      );
    }
    return liste;
  }, [satirlar, personelFiltre, istasyon, toggles, personelKumesi, arama]);

  const gruplar = useMemo(() => {
    const harita = personeleGoreGrupla(gorunenSatirlar);
    return [...harita.entries()]
      .map(([pid, liste]) => {
        const sira = yerelSira[pid];
        const sirali = sira ? [...liste].sort((a, b) => sira.indexOf(a.satir_id) - sira.indexOf(b.satir_id)) : liste;
        // Grup sırası: personelin ilk eklenen satırının zamanı (yeni eklenen personel en üstte)
        const ilk = liste.reduce((m, x) => {
          const t = eklenme[x.satir_id] ?? "";
          return !m || (t && t < m) ? t || m : m;
        }, "");
        return { pid, ad: liste[0]?.personel_adi ?? pid, istasyon: liste[0]?.personel_istasyon ?? null, satirlar: sirali, ilk };
      })
      .sort((a, b) => b.ilk.localeCompare(a.ilk) || a.ad.localeCompare(b.ad, "tr"));
  }, [gorunenSatirlar, yerelSira, eklenme]);

  const eklenmisPersonel = useMemo(() => new Set(satirlar.map((s) => s.personel_id)), [satirlar]);
  const personelAdlari = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of personeller) m.set(p.user_id, p.full_name);
    for (const s of satirlar) if (s.personel_adi) m.set(s.personel_id, s.personel_adi);
    return m;
  }, [personeller, satirlar]);

  // ── sayaçlar ──
  const gormeyenler = useMemo(() => {
    const set = new Set<string>();
    for (const y of yayinlar) {
      if (y.bildirim_gonder && y.durum === "gonderildi") for (const id of y.onaylamayanlar ?? []) set.add(id);
    }
    return [...set];
  }, [yayinlar]);

  const degisenSayisi = satirlar.filter((s) => s.degisti).length;

  // ── işlemler ──
  const [busy, setBusy] = useState(false);

  const kaydet = useCallback(
    async (satirId: string, alanlar: Partial<SatirKaydetGirdi>) => {
      const r = await satirKaydet({ satir_id: satirId, ...alanlar });
      if (!r.success) toast.error(hataMesaji(r));
      yenile();
    },
    [yenile],
  );

  const satirEkle = async (personelId: string) => {
    if (!plan) return;
    const ist = istasyonEsle(personelIstasyonu.get(personelId));
    const r = await satirKaydet({ plan_id: plan.plan_id, personel_id: personelId, ...(ist ? { istasyon: ist } : {}) });
    if (!r.success) toast.error(hataMesaji(r));
    yenile();
  };

  /** Seçilen personellerin her birine ürünsüz (boş) bir satır açar; ürün sonra seçilir */
  const personelleriEkle = async (personelIdleri: string[]) => {
    if (!plan) return;
    let eklenen = 0;
    for (const pid of personelIdleri) {
      const ist = istasyonEsle(personelIstasyonu.get(pid));
      const r = await satirKaydet({ plan_id: plan.plan_id, personel_id: pid, ...(ist ? { istasyon: ist } : {}) });
      if (r.success) eklenen++;
      else toast.error(`${personelAdlari.get(pid) ?? pid}: ${hataMesaji(r)}`);
    }
    if (eklenen > 0) toast.success(`${eklenen} personel eklendi. Ürünleri yanlarından seçebilirsiniz.`);
    yenile();
  };

  const [pasifHedef, setPasifHedef] = useState<PasifHedef | null>(null);
  const [silHedef, setSilHedef] = useState<TalimatSatir | null>(null);
  const [yayinAcik, setYayinAcik] = useState(false);
  const [kopyaOnay, setKopyaOnay] = useState(false);
  const [filtreAcik, setFiltreAcik] = useState(false);
  const [istasyonOnay, setIstasyonOnay] = useState(false);
  const [kapaliGruplar, setKapaliGruplar] = useState<Set<string>>(new Set());
  const grupToggle = (pid: string) =>
    setKapaliGruplar((p) => {
      const n = new Set(p);
      if (n.has(pid)) n.delete(pid);
      else n.add(pid);
      return n;
    });

  const filtreSayisi = (personelFiltre ? 1 : 0) + (istasyon ? 1 : 0) + toggles.size + (personelKumesi ? 1 : 0);

  // ── istasyonu personele göre düzelt (aday: istasyon boş [=montaj varsayılan] veya 'montaj' ama personelin istasyonu başka) ──
  const personelIstasyonu = useMemo(() => new Map(personeller.map((p) => [p.user_id, p.station])), [personeller]);
  const istasyonAdaylari = useMemo(
    () =>
      satirlar.flatMap((s) => {
        if (s.plaka_id) return [];
        const hedef = istasyonEsle(personelIstasyonu.get(s.personel_id) ?? s.personel_istasyon);
        if (!hedef) return [];
        const uygun = s.istasyon === null ? hedef !== "montaj" : s.istasyon === "montaj" && hedef !== "montaj";
        return uygun ? [{ satir: s, hedef }] : [];
      }),
    [satirlar, personelIstasyonu],
  );
  const istasyonlariDuzelt = async () => {
    setBusy(true);
    let ok = 0;
    for (const { satir, hedef } of istasyonAdaylari) {
      const r = await satirKaydet({ satir_id: satir.satir_id, istasyon: hedef });
      if (r.success) ok++;
      else toast.error(`${satir.personel_adi ?? satir.personel_id}: ${hataMesaji(r)}`);
    }
    setBusy(false);
    setIstasyonOnay(false);
    if (ok > 0) toast.success(`${ok} satırın istasyonu personele göre düzeltildi`);
    yenile();
  };

  // ── derin bağlantı: filtreleri temizle, grubu aç, satıra kaydır, 3 sn vurgula ──
  const [parlayanSatir, setParlayanSatir] = useState<string | null>(null);
  const islenenSatir = useRef<string | null>(null);
  const filtreTemizlendi = useRef<string | null>(null);
  useEffect(() => {
    if (!vurguSatir || islenenSatir.current === vurguSatir) return;
    const hedef = satirlar.find((x) => x.satir_id === vurguSatir);
    if (!hedef) return;
    if (!gorunenSatirlar.some((x) => x.satir_id === vurguSatir)) {
      if (filtreTemizlendi.current !== vurguSatir) {
        filtreTemizlendi.current = vurguSatir;
        filtreTemizle();
        toast.info("Filtreler temizlendi");
      }
      return;
    }
    islenenSatir.current = vurguSatir;
    setKapaliGruplar((p) => {
      if (!p.has(hedef.personel_id)) return p;
      const n = new Set(p);
      n.delete(hedef.personel_id);
      return n;
    });
    let deneme = 0;
    const git = () => {
      const el = document.getElementById(`satir-${vurguSatir}`);
      if (!el) {
        if (deneme++ < 15) setTimeout(git, 100);
        return;
      }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setParlayanSatir(vurguSatir);
      setTimeout(() => setParlayanSatir((p) => (p === vurguSatir ? null : p)), 3000);
    };
    setTimeout(git, 150);
  }, [vurguSatir, satirlar, gorunenSatirlar]);

  const islem: SatirIslemleri = useMemo(
    () => ({
      kaydet,
      pasifEt: (s) =>
        setPasifHedef({
          kapsam: "satir",
          ids: [s.satir_id],
          baslik: `${s.personel_adi ?? ""} · ${s.sira}. sıra ${s.sku ? `(${s.sku})` : ""}`,
        }),
      pasifKaldir: async (s) => {
        if (!plan) return;
        const r = await talimatPasifKaldir({ kapsam: "satir", planId: plan.plan_id, ids: [s.satir_id] });
        if (!r.success) toast.error(hataMesaji(r));
        else toast.success("Pasif kaldırıldı");
        yenile();
      },
      sil: (s) => setSilHedef(s),
    }),
    [kaydet, plan, yenile],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const onDragEnd = async (e: DragEndEvent) => {
    if (!plan || !e.over || e.active.id === e.over.id) return;
    const aktif = satirlar.find((s) => s.satir_id === e.active.id);
    const hedef = satirlar.find((s) => s.satir_id === e.over!.id);
    if (!aktif || !hedef || aktif.personel_id !== hedef.personel_id) {
      toast.error("Satır yalnızca aynı personelin listesinde taşınabilir");
      return;
    }
    const pid = aktif.personel_id;
    const tam = yerelSira[pid] ?? (tumGrup.get(pid) ?? []).map((s) => s.satir_id);
    const yeni = arrayMove(tam, tam.indexOf(aktif.satir_id), tam.indexOf(hedef.satir_id));
    setYerelSira((p) => ({ ...p, [pid]: yeni }));
    const r = await satirSirala(plan.plan_id, pid, yeni);
    if (!r.success) {
      toast.error(hataMesaji(r));
      setYerelSira((p) => {
        const n = { ...p };
        delete n[pid];
        return n;
      });
    }
    yenile();
  };

  const haftaGit = (h: string) => router.push(`/ops/board/mavi-yaka?hafta=${h}`);

  const planOlustur = async () => {
    setBusy(true);
    const r = await planGetirVeyaOlustur(hafta);
    setBusy(false);
    if (!r.success) toast.error(hataMesaji(r));
    else toast.success("Plan oluşturuldu (taslak)");
    yenile();
  };

  const haftaKopyala = async () => {
    if (!plan) return;
    setBusy(true);
    const hedef = gunEkle(hafta, 7);
    const r = await planKopyala(plan.plan_id, hedef);
    setBusy(false);
    setKopyaOnay(false);
    if (!r.success) return void toast.error(hataMesaji(r));
    toast.success("Plan yeni haftaya kopyalandı (taslak)");
    haftaGit(hedef);
  };

  const [guncelGun, setGuncelGun] = useState("1");
  const [guncelAcik, setGuncelAcik] = useState(false);
  const guncelle = async () => {
    if (!plan) return;
    const r = await guncelIsaretle(plan.plan_id, Number(guncelGun));
    if (!r.success) return void toast.error(hataMesaji(r));
    toast.success(`Liste ${formatDate(r.data)} tarihine kadar güncel işaretlendi`);
    setGuncelAcik(false);
    yenile();
  };

  const eklenebilir = personeller.filter((p) => !eklenmisPersonel.has(p.user_id));

  const doluSatirlar = satirlar.filter((s) => !satirBos(s));
  const tumListePasif = !!plan && doluSatirlar.length > 0 && doluSatirlar.every((s) => s.etkin_pasif);

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {/* Başlık: büyük ana buton solda, ikincil işlemler sağda kompakt */}
        <div className="flex flex-wrap items-center gap-4">
          {editable && plan && <PersonelEkle eklenebilir={eklenebilir} onEkle={personelleriEkle} />}
          <div>
            <h1 className="text-2xl font-bold text-vw-dark">Mavi Yaka Görev İş Talimatları</h1>
            <p className="text-sm text-muted-foreground">
              Haftalık personel planı{!planner && " (salt okunur)"}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link href="/ops/board">
                <ArrowLeft className="mr-1 h-4 w-4" /> Geri
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link href="/talepler">
                <ClipboardList className="mr-1.5 h-4 w-4" /> Talepler
              </Link>
            </Button>
            {planner && plan && plan.durum !== "pasif" && (
              <>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => setYayinAcik(true)}>
                  <Send className="mr-1.5 h-4 w-4" /> Yayınla
                  {plan.degisen_satir_sayisi > 0 && (
                    <span className="ml-1.5 rounded-full bg-vw-deep px-1.5 text-[11px] text-white">{plan.degisen_satir_sayisi}</span>
                  )}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" aria-label="Diğer işlemler">
                      <MoreHorizontal className="mr-1 h-4 w-4" /> İşlemler
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuItem onClick={() => setGuncelAcik(true)}>
                      <Check className="mr-2 h-4 w-4" /> Güncel işaretle
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={busy}
                      onClick={async () => {
                        const r = await talimatYayinla({ planId: plan.plan_id, bildirimGonder: false, hedef: plan.durum === "taslak" ? "herkes" : "degisenler" });
                        if (!r.success) toast.error(hataMesaji(r));
                        else toast.success("Liste bildirimsiz yenilendi");
                        yenile();
                      }}
                    >
                      <Send className="mr-2 h-4 w-4" /> Bildirimsiz yenile
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={busy} onClick={() => setKopyaOnay(true)}>
                      <Copy className="mr-2 h-4 w-4" /> Bu haftayı kopyala → yeni hafta
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={istasyonAdaylari.length === 0} onClick={() => setIstasyonOnay(true)}>
                      <Wand2 className="mr-2 h-4 w-4" /> İstasyonları personele göre düzelt
                      {istasyonAdaylari.length > 0 && <span className="ml-auto text-[11px] text-muted-foreground">{istasyonAdaylari.length}</span>}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {tumListePasif ? (
                      <DropdownMenuItem
                        onClick={async () => {
                          const r = await talimatPasifKaldir({ kapsam: "liste", planId: plan.plan_id });
                          if (!r.success) toast.error(hataMesaji(r));
                          else toast.success("Liste pasifi kaldırıldı");
                          yenile();
                        }}
                      >
                        <PlayCircle className="mr-2 h-4 w-4" /> Tüm listeyi aktifleştir
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => setPasifHedef({ kapsam: "liste", ids: [], baslik: "Tüm liste (bütün personel) pasif edilecek" })}
                      >
                        <PauseCircle className="mr-2 h-4 w-4" /> Tüm listeyi pasif et
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        {/* Hafta seçici + plan durumu */}
        <Card className="flex-row flex-wrap items-center gap-2 p-3">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => haftaGit(gunEkle(hafta, -7))} aria-label="Önceki hafta">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant={hafta === buHafta ? "default" : "outline"} size="sm" className={cn(hafta === buHafta && "bg-vw-deep text-white")} onClick={() => haftaGit(buHafta)}>
              Bu hafta
            </Button>
            <Button
              variant={hafta === gunEkle(buHafta, 7) ? "default" : "outline"}
              size="sm"
              className={cn(hafta === gunEkle(buHafta, 7) && "bg-vw-deep text-white")}
              onClick={() => haftaGit(gunEkle(buHafta, 7))}
            >
              Gelecek hafta
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => haftaGit(gunEkle(hafta, 7))} aria-label="Sonraki hafta">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-sm font-semibold text-vw-dark">
            {formatDate(hafta)} – {formatDate(gunEkle(hafta, 6))}
          </div>
          {plan ? (
            <Badge className={cn("border-0", PLAN_RENK[plan.durum])}>{PLAN_DURUM_LABEL[plan.durum]}</Badge>
          ) : (
            <Badge variant="outline">Plan yok</Badge>
          )}

          {plan && plan.durum !== "taslak" && (
            <Badge
              className={cn("border-0", plan.guncel_mi ? "bg-[#d4eee5] text-[#2f7d66]" : "bg-[#fbdde1] text-[#c0424f]")}
            >
              {plan.guncel_mi ? `Güncel: ${formatDate(plan.guncel_bitis)} tarihine kadar` : "Liste güncel değil"}
            </Badge>
          )}
        </Card>

        {/* Plan yok */}
        {!plan && (
          <Card className="items-center gap-3 border-dashed p-10 text-center">
            <div className="text-lg font-semibold text-vw-dark">Bu hafta için plan yok</div>
            <p className="text-sm text-muted-foreground">
              {planner ? "Taslak bir plan oluşturup personel ekleyerek başlayın." : "Planlama yetkisi olan bir kullanıcı plan oluşturduğunda burada görünecek."}
            </p>
            {planner && (
              <Button className="bg-vw-deep text-white hover:bg-vw-dark" disabled={busy} onClick={planOlustur}>
                <Plus className="mr-1.5 h-4 w-4" /> Plan oluştur
              </Button>
            )}
          </Card>
        )}

        {plan && (
          <>
            {/* Özet sayaçları */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {gormeyenler.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPersonelKumesi(personelKumesi ? null : gormeyenler)}
                  className={cn(
                    "rounded-full border px-3 py-1 font-medium",
                    personelKumesi ? "border-[#c0424f] bg-[#c0424f] text-white" : "border-[#c0424f]/40 bg-[#fbdde1] text-[#c0424f] hover:bg-[#f7ccd2]",
                  )}
                >
                  {gormeyenler.length} personel değişiklikleri görmedi
                </button>
              )}
              {degisenSayisi > 0 && (
                <button
                  type="button"
                  onClick={() => toggle("degisen")}
                  className="rounded-full border border-[#f28a19]/40 bg-[#fde8cf] px-3 py-1 font-medium text-[#b8650c]"
                >
                  {degisenSayisi} yayınlanmamış değişiklik
                </button>
              )}
              <span className="text-muted-foreground">
                {plan.personel_sayisi} personel · {plan.satir_sayisi} satır
              </span>
            </div>

            {/* Arama + Filtreler (tek arama kutusu; tüm filtreler yan panelde) */}
            <div className="mb-4 flex flex-wrap items-center gap-2 border-b pb-3">
              <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={arama}
                  onChange={(e) => setArama(e.target.value)}
                  placeholder="Personel, ürün kodu veya adı ara"
                  className="h-9 pl-8"
                />
              </div>
              <Button variant="outline" size="sm" className="h-9" onClick={() => setFiltreAcik(true)}>
                <SlidersHorizontal className="mr-1.5 h-4 w-4" /> Filtreler
                {filtreSayisi > 0 && (
                  <span className="ml-1.5 rounded-full bg-vw-deep px-1.5 text-[11px] font-semibold text-white">{filtreSayisi}</span>
                )}
              </Button>
              {filtreAktif && (
                <Button variant="ghost" size="sm" className="h-9" onClick={filtreTemizle}>
                  <X className="mr-1 h-4 w-4" /> Temizle
                </Button>
              )}
              {personelKumesi && (
                <span className="rounded-full border border-[#c0424f] px-3 py-0.5 text-xs font-medium text-[#c0424f]">
                  Görmeyen {personelKumesi.length} personel
                </span>
              )}
            </div>

            <Sheet open={filtreAcik} onOpenChange={setFiltreAcik}>
              <SheetContent side="right" className="w-full gap-0 sm:max-w-sm">
                <SheetHeader>
                  <SheetTitle>Filtreler</SheetTitle>
                  <SheetDescription>Listeyi daraltmak için kullanın. Aktif filtre: {filtreSayisi}</SheetDescription>
                </SheetHeader>
                <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
                  <div>
                    <div className="mb-1 text-xs font-medium">Personel</div>
                    <select
                      value={personelFiltre}
                      onChange={(e) => setPersonelFiltre(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    >
                      <option value="">Tüm personel</option>
                      {[...tumGrup.keys()]
                        .sort((a, b) => (personelAdlari.get(a) ?? a).localeCompare(personelAdlari.get(b) ?? b, "tr"))
                        .map((id) => (
                          <option key={id} value={id}>
                            {personelAdlari.get(id) ?? id}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium">İstasyon</div>
                    <select
                      value={istasyon}
                      onChange={(e) => setIstasyon(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    >
                      <option value="">Tüm istasyonlar</option>
                      {TALIMAT_ISTASYONLAR.map((i) => (
                        <option key={i.value} value={i.value}>
                          {i.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium">Durum</div>
                    <div className="flex flex-wrap gap-1.5">
                      {TOGGLES.map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => toggle(t.key)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            toggles.has(t.key) ? "border-vw-deep bg-vw-deep text-white" : "border-border hover:bg-muted",
                          )}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <SheetFooter className="flex-row justify-between border-t">
                  <Button variant="outline" onClick={filtreTemizle}>
                    <X className="mr-1 h-4 w-4" /> Temizle
                  </Button>
                  <Button onClick={() => setFiltreAcik(false)} className="bg-vw-deep text-white hover:bg-vw-dark">
                    Listeyi göster ({gorunenSatirlar.length})
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            {/* Tablo */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <div className="max-h-[calc(100dvh-14rem)] min-h-[320px] overflow-auto rounded-lg border bg-card">
                <table className="w-full min-w-[1180px] border-collapse">
                  <thead className="text-left text-xs font-semibold uppercase tracking-wide text-vw-deep">
                    <tr>
                      {(["Sıra", "İstasyon", "Ürün Kodu", "Ürün Adı", "Güncel Stok", "Üretim Miktarı", "İstenen Miktar", "Fark", "Not", "Durum", ""] as const).map((h, i) => (
                        <th
                          key={i}
                          className={cn("sticky top-0 z-20 h-9 bg-vw-light px-2", (h === "Güncel Stok" || h === "Fark") && "text-right")}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {gruplar.length === 0 ? (
                    <tbody>
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-sm text-muted-foreground">
                          {satirlar.length === 0 ? "Henüz personel eklenmedi." : "Filtreye uyan satır yok."}
                        </td>
                      </tr>
                    </tbody>
                  ) : (
                    gruplar.map((g) => {
                      const tamListe = tumGrup.get(g.pid) ?? [];
                      const personelPasif = tamListe.length > 0 && tamListe.every((s) => s.etkin_pasif);
                      const pasifVar = tamListe.some((s) => s.etkin_pasif);
                      return (
                        <tbody key={g.pid}>
                          <tr className="border-y">
                            <td colSpan={11} className="sticky top-9 z-10 bg-[#e6dfc9] px-3 py-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => grupToggle(g.pid)}
                                  aria-label={kapaliGruplar.has(g.pid) ? "Grubu aç" : "Grubu kapat"}
                                  className="rounded p-0.5 hover:bg-black/10"
                                >
                                  <ChevronDown className={cn("h-4 w-4 transition-transform", kapaliGruplar.has(g.pid) && "-rotate-90")} />
                                </button>
                                <span className="text-sm font-bold text-vw-dark">{g.ad}</span>
                                {g.istasyon && (
                                  <Badge variant="outline" className="border-vw-side/60 text-[11px] text-vw-deep">
                                    {g.istasyon}
                                  </Badge>
                                )}
                                {personelPasif && <Badge className="border-0 bg-[#cfd8dc] text-[#546e7a]">Pasif</Badge>}
                                <span className="text-xs text-muted-foreground">{tamListe.length} satır</span>
                                {editable && (
                                  <div className="ml-auto flex items-center gap-1">
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => satirEkle(g.pid)}>
                                      <Plus className="mr-1 h-3.5 w-3.5" /> satır
                                    </Button>
                                    {pasifVar ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={async () => {
                                          const r1 = await talimatPasifKaldir({ kapsam: "personel", planId: plan.plan_id, ids: [g.pid] });
                                          const pasifSatirlar = tamListe.filter((s) => s.durum === "pasif").map((s) => s.satir_id);
                                          if (pasifSatirlar.length)
                                            await talimatPasifKaldir({ kapsam: "satir", planId: plan.plan_id, ids: pasifSatirlar });
                                          if (!r1.success) toast.error(hataMesaji(r1));
                                          else toast.success("Pasif kaldırıldı");
                                          yenile();
                                        }}
                                      >
                                        <PlayCircle className="mr-1 h-3.5 w-3.5" /> Pasifi kaldır
                                      </Button>
                                    ) : null}
                                    {!personelPasif && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => setPasifHedef({ kapsam: "personel", ids: [g.pid], baslik: `${g.ad} tüm listesi pasif edilecek` })}
                                      >
                                        <EyeOff className="mr-1 h-3.5 w-3.5" /> Personeli pasif et
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                          <SortableContext items={g.satirlar.map((s) => s.satir_id)} strategy={verticalListSortingStrategy}>
                            {!kapaliGruplar.has(g.pid) && g.satirlar.map((s) => {
                              // Ürünsüz (boş) satırlar atlanır: en yakın dolu önceki/sonraki satır
                              const onceki = [...tamListe].reverse().find((x) => x.sira < s.sira && x.sku);
                              const sonraki = tamListe.find((x) => x.sira > s.sira && x.sku);
                              const engelli: Record<string, string> = {};
                              if (onceki?.sku) engelli[onceki.sku] = "Önceki satırda aynı ürün var";
                              if (sonraki?.sku) engelli[sonraki.sku] = "Sonraki satırda aynı ürün var";
                              return (
                                <SatirRow
                                  key={s.satir_id}
                                  s={s}
                                  editable={editable}
                                  engelli={engelli}
                                  depoStoklari={s.sku ? stoklar[s.sku] : undefined}
                                  islem={islem}
                                  sirali
                                  parlak={parlayanSatir === s.satir_id}
                                />
                              );
                            })}
                          </SortableContext>
                        </tbody>
                      );
                    })
                  )}
                </table>
              </div>
            </DndContext>

            <YayinGecmisi yayinlar={yayinlar} editable={editable} onChanged={yenile} />
          </>
        )}

        {/* Diyaloglar */}
        {plan && (
          <>
            <YayinDialog open={yayinAcik} plan={plan} gelecekHafta={gelecekHafta} onClose={() => setYayinAcik(false)} onDone={yenile} />
            <PasifDialog planId={plan.plan_id} hedef={pasifHedef} onClose={() => setPasifHedef(null)} onDone={yenile} />
          </>
        )}

        <AlertDialog open={!!silHedef} onOpenChange={(o) => !o && setSilHedef(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {silHedef && satirlar.filter((x) => x.personel_id === silHedef.personel_id).length <= 1
                  ? "Personel listeden çıkarılsın mı?"
                  : "Satır silinsin mi?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {silHedef?.personel_adi} · {silHedef?.sira}. sıra {silHedef?.sku ? `(${silHedef.sku})` : ""} silinecek, diğer sıralar yukarı kayacak.
                {silHedef && satirlar.filter((x) => x.personel_id === silHedef.personel_id).length <= 1 && (
                  <span className="mt-1 block font-medium text-[#c0424f]">
                    Bu personelin son satırı: personel listeden de çıkarılacak.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Vazgeç</AlertDialogCancel>
              <AlertDialogAction
                className="bg-[#c0424f] text-white hover:bg-[#a63744]"
                onClick={async () => {
                  if (!silHedef) return;
                  const r = await satirSil(silHedef.satir_id);
                  if (!r.success) toast.error(hataMesaji(r));
                  else toast.success("Satır silindi");
                  setSilHedef(null);
                  yenile();
                }}
              >
                Sil
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={guncelAcik} onOpenChange={setGuncelAcik}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Listeyi güncel işaretle</DialogTitle>
              <DialogDescription>Kaç gün güncel kalsın?</DialogDescription>
            </DialogHeader>
            <select
              value={guncelGun}
              onChange={(e) => setGuncelGun(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {[1, 2, 3, 4, 5, 6, 7].map((g) => (
                <option key={g} value={g}>
                  {g} gün ({formatDate(gunEkle(new Date().toLocaleDateString("sv-SE"), g - 1))} tarihine kadar)
                </option>
              ))}
            </select>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGuncelAcik(false)}>
                Vazgeç
              </Button>
              <Button className="bg-vw-deep text-white hover:bg-vw-dark" onClick={guncelle}>
                İşaretle
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={istasyonOnay} onOpenChange={setIstasyonOnay}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>İstasyonlar personele göre düzeltilsin mi?</AlertDialogTitle>
              <AlertDialogDescription>
                {istasyonAdaylari.length} satırın istasyonu, personelin kayıtlı istasyonuna göre değiştirilecek (yalnızca istasyonu boş
                veya &quot;Montaj&quot; olup personeli başka istasyonda olan satırlar; elle seçilmiş Kesim/Paketleme ve plakalı satırlara dokunulmaz).
                <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-xs">
                  {istasyonAdaylari.slice(0, 30).map(({ satir, hedef }) => (
                    <li key={satir.satir_id}>
                      {satir.personel_adi} · {satir.sira}. sıra → {TALIMAT_ISTASYONLAR.find((i) => i.value === hedef)?.label}
                    </li>
                  ))}
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Vazgeç</AlertDialogCancel>
              <AlertDialogAction className="bg-vw-deep text-white hover:bg-vw-dark" onClick={istasyonlariDuzelt}>
                Düzelt
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={kopyaOnay} onOpenChange={setKopyaOnay}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Haftayı kopyala</AlertDialogTitle>
              <AlertDialogDescription>
                Bu haftanın tüm satırları {formatDate(gunEkle(hafta, 7))} – {formatDate(gunEkle(hafta, 13))} haftasına taslak olarak kopyalanacak
                (pasif ve tamamlanan satırlar aktif olur; hedef hafta boş olmalı).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Vazgeç</AlertDialogCancel>
              <AlertDialogAction className="bg-vw-deep text-white hover:bg-vw-dark" onClick={haftaKopyala}>
                Kopyala
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}

"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  ArrowLeft,
  Check,
  RotateCcw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Copy,
  CopyPlus,
  EyeOff,
  ListChecks,
  MoreHorizontal,
  Pencil,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Send,
  Sigma,
  SlidersHorizontal,
  Trash2,
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
  satirYenidenAktifEt,
  satirSil,
  talimatYayinla,
  type TalimatPasifKayit,
} from "@/lib/talimat/actions";
import { hatPasifYap, satirlariHattaKopyala, satirSiralaHat } from "@/lib/talimat/hat-actions";
import { Checkbox } from "@/components/ui/checkbox";
import { PLAN_DURUM_LABEL, TALIMAT_ISTASYONLAR } from "@/lib/talimat/constants";
import { gunEkle, hataGoreGrupla, satirBosMu, satirFiltrele } from "@/lib/talimat/helpers";
import type {
  SatirKaydetGirdi,
  TalimatHat,
  TalimatPlan,
  TalimatSatir,
  TalimatSatirFiltre,
  TalimatYayin,
  UrunStokSecenek,
  ZamanliIslem,
} from "@/lib/talimat/types";
import { cn, formatDate } from "@/lib/utils";
import { HatNokta } from "@/components/shared/hat-nokta";
import { HAT_YAZI_RENGI, hatRengi, hatRengiAcik } from "@/lib/talimat/hat-renk";
import { HAT_TUR_LABEL, HatDuzenleDialog, HatEkle } from "./hat-ekle";
import { PasifDialog, PasifKaldirDialog, type PasifHedef, type PasifKaldirHedef } from "./pasif-dialog";
import { SatirRow, type SatirIslemleri } from "./satir-row";
import { YayinDialog } from "./yayin-dialog";
import { ZamanliListeDialog, zamanliOzet } from "./zamanli-liste";
import { YenidenAktifDialog } from "./yeniden-aktif-dialog";
import { YayinGecmisi } from "./yayin-gecmisi";

interface Props {
  hafta: string;
  buHafta: string;
  plan: TalimatPlan | null;
  /** Yalnız hat satırları (hat_id dolu) */
  satirlar: TalimatSatir[];
  yayinlar: TalimatYayin[];
  /** Tüm hatlar (pasif olanlar dahil), hat sırasıyla */
  hatlar: TalimatHat[];
  stoklar: Record<string, UrunStokSecenek["depo_stoklari"]>;
  planner: boolean;
  /** Aktif hat/liste pasif kayıtları (rozetler + kaldırma) */
  pasifKayitlari: TalimatPasifKayit[];
  /** Bekleyen zamanlı pasif/aktif işlemleri (SQL 164; yalnız planlayıcı) */
  zamanliIslemler: ZamanliIslem[];
  /** Derin bağlantı (?satir=<id>): grubu aç, satıra kaydır, 3 sn vurgula */
  vurguSatir: string | null;
}

const PLAN_RENK: Record<string, string> = {
  taslak: "bg-[#fde8cf] text-[#b8650c]",
  yayinda: "bg-[#d4eee5] text-[#2f7d66]",
  pasif: "bg-[#eceff1] text-[#546e7a]",
};

type Toggle = "oncelik1" | "oncelik1Seanssiz" | "degisen" | "onaysiz" | "pasif";

const TOGGLES: Array<{ key: Toggle; label: string }> = [
  { key: "oncelik1", label: "Sadece 1. sıra" },
  { key: "oncelik1Seanssiz", label: "1. sıra, seans açılmamış" },
  { key: "degisen", label: "Değişenler" },
  { key: "onaysiz", label: "Onay bekleyenler" },
  { key: "pasif", label: "Pasifler" },
];

/** Satırın tablo bloğu: aktif (boş dahil) | tamamlanmış | pasif */
function blokTuru(s: TalimatSatir): "aktif" | "tamam" | "pasif" {
  if (s.etkin_pasif || s.durum === "pasif") return "pasif";
  if (s.etkin_durum === "tamamlandi") return "tamam";
  return "aktif";
}

function hataMesaji(r: { error: string; code?: string }): string {
  if (r.code === "PLAN_PASIF") return "Pasif plan düzenlenemez.";
  if (r.code === "ARDISIK_SKU") return `Aynı hatta aynı ürün arka arkaya verilemez: ${r.error}`;
  return r.error;
}

/** "DÖŞEME HATTI" -> "DÖŞEME HATTI'na"; diğer adlar -> "<ad> hattına" */
function hataEki(ad: string): string {
  return /hattı$/i.test(ad.trim()) ? `${ad}'na` : `${ad} hattına`;
}

/** Çakışma: önce imleç altındaki alan (hat başlığı / satır), yoksa en yakın merkez */
const cakisma: CollisionDetection = (args) => {
  const p = pointerWithin(args);
  return p.length > 0 ? p : closestCenter(args);
};

/** Hat başlık satırı: başka hattan sürüklenen satırlar buraya bırakılınca kopyalanır */
function HatDropRow({ hatId, disabled, children }: { hatId: string; disabled: boolean; children: (isOver: boolean) => ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `hat:${hatId}`, disabled });
  return (
    <tr ref={setNodeRef} className="border-y">
      {children(isOver && !disabled)}
    </tr>
  );
}

export function MaviYakaClient({ hafta, buHafta, plan, satirlar, yayinlar, hatlar, stoklar, planner, pasifKayitlari, zamanliIslemler, vurguSatir }: Props) {
  const router = useRouter();
  const yenile = useCallback(() => router.refresh(), [router]);

  useRealtimeSubscription({
    channelName: "talimat-mavi-yaka",
    subscriptions: [
      { event: "*", table: "talimat_satirlar" },
      { event: "*", table: "talimat_planlar" },
      { event: "*", table: "talimat_pasifler" },
      { event: "*", table: "talimat_yayinlar" },
      { event: "*", table: "talimat_onaylar" },
      { event: "*", table: "talimat_hatlar" },
      { event: "*", table: "talepler" },
    ],
    debounceMs: 1200,
  });

  const editable = planner && !!plan && plan.durum !== "pasif";
  const gelecekHafta = hafta > buHafta;

  // ── filtreler ──
  const [hatFiltre, setHatFiltre] = useState("");
  const [arama, setArama] = useState("");
  const [istasyon, setIstasyon] = useState("");
  const [toggles, setToggles] = useState<Set<Toggle>>(new Set());
  const [hatKumesi, setHatKumesi] = useState<string[] | null>(null);

  const toggle = (k: Toggle) =>
    setToggles((p) => {
      const n = new Set(p);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const filtreAktif = !!(hatFiltre || arama || istasyon || toggles.size || hatKumesi);
  const filtreTemizle = () => {
    setHatFiltre("");
    setArama("");
    setIstasyon("");
    setToggles(new Set());
    setHatKumesi(null);
  };

  // ── iyimser sıralama (hat_id -> satır id sırası) ──
  const [yerelSira, setYerelSira] = useState<Record<string, string[]>>({});
  useEffect(() => setYerelSira({}), [satirlar]);

  const tumGrup = useMemo(() => hataGoreGrupla(satirlar), [satirlar]);
  /** Hat içinde her satırın en yakın görünen komşu SKU'ları (boş/pasif/tamamlanan satırlar atlanır): satır_id -> {sku -> neden} */
  const engelliSkular = useMemo(() => {
    const m = new Map<string, Record<string, string>>();
    for (const liste of tumGrup.values()) {
      const sirali = [...liste].sort((a, b) => a.sira - b.sira);
      const gorunen = sirali.filter((s) => s.sku && s.durum !== "pasif" && s.etkin_durum !== "tamamlandi");
      for (const s of sirali) {
        const o: Record<string, string> = {};
        let onceki: (typeof gorunen)[number] | undefined;
        let sonraki: (typeof gorunen)[number] | undefined;
        for (const g of gorunen) {
          if (g.satir_id === s.satir_id) continue;
          if (g.sira < s.sira) onceki = g;
          else if (g.sira > s.sira && !sonraki) sonraki = g;
        }
        if (onceki?.sku) o[onceki.sku] = "Önceki satırda aynı ürün var";
        if (sonraki?.sku) o[sonraki.sku] = o[sonraki.sku] ? "Önceki/sonraki satırda aynı ürün var" : "Sonraki satırda aynı ürün var";
        m.set(s.satir_id, o);
      }
    }
    return m;
  }, [tumGrup]);
  const hatHaritasi = useMemo(() => new Map(hatlar.map((h) => [h.hat_id, h])), [hatlar]);

  const gorunenSatirlar = useMemo(() => {
    const f: TalimatSatirFiltre = {
      istasyon: (istasyon || undefined) as TalimatSatirFiltre["istasyon"],
      sadeceOncelik1: toggles.has("oncelik1"),
      oncelik1SeansBaslamamis: toggles.has("oncelik1Seanssiz"),
      sadeceDegisen: toggles.has("degisen"),
      sadeceOnaylamayan: toggles.has("onaysiz"),
      sadecePasif: toggles.has("pasif"),
    };
    // Tamamlananlar da listede kalır (aktiflerin altında "Tamamlandı" bloğu)
    let liste = satirFiltrele(satirlar, f).filter((s) => !!s.hat_id);
    if (hatFiltre) liste = liste.filter((s) => s.hat_id === hatFiltre);
    if (hatKumesi) liste = liste.filter((s) => s.hat_id && hatKumesi.includes(s.hat_id));
    const q = arama.trim().toLocaleLowerCase("tr");
    if (q) {
      liste = liste.filter((s) => `${s.sku ?? ""} ${s.urun_adi ?? ""} ${s.hat_adi ?? ""}`.toLocaleLowerCase("tr").includes(q));
    }
    return liste;
  }, [satirlar, hatFiltre, istasyon, toggles, hatKumesi, arama]);

  const gruplar = useMemo(() => {
    const harita = hataGoreGrupla(gorunenSatirlar);
    // Satıra göre daraltan filtre yokken tüm hatlar görünür (boş hatlara da satır eklenebilsin)
    const daraltan = !!(arama.trim() || istasyon || toggles.size);
    return hatlar
      .filter((h) => (!hatFiltre || h.hat_id === hatFiltre) && (!hatKumesi || hatKumesi.includes(h.hat_id)))
      .map((hat) => {
        const liste = harita.get(hat.hat_id) ?? [];
        const sira = yerelSira[hat.hat_id];
        const sirali = sira ? [...liste].sort((a, b) => sira.indexOf(a.satir_id) - sira.indexOf(b.satir_id)) : [...liste].sort((a, b) => a.sira - b.sira);
        // Blok sırası: aktifler (sira) -> tamamlananlar -> pasifler
        const aktifler = sirali.filter((x) => blokTuru(x) === "aktif");
        const tamamlananlar = sirali.filter((x) => blokTuru(x) === "tamam");
        const pasifler = sirali.filter((x) => blokTuru(x) === "pasif");
        return { hat, satirlar: [...aktifler, ...tamamlananlar, ...pasifler], aktifler, tamamlananlar, pasifler };
      })
      .filter((g) => !daraltan || g.satirlar.length > 0);
  }, [gorunenSatirlar, hatlar, yerelSira, arama, istasyon, toggles, hatFiltre, hatKumesi]);

  // Hat başına görünen sıra numarası (tamamlananlar hariç, 1..n; yerel sürükleme sırası dikkate alınır)
  const siraHaritasi = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const [hid, liste] of tumGrup) {
      const yerel = yerelSira[hid];
      const aktif = liste
        .filter((x) => blokTuru(x) === "aktif")
        .sort((a, b) => (yerel ? yerel.indexOf(a.satir_id) - yerel.indexOf(b.satir_id) : a.sira - b.sira));
      m.set(hid, new Map(aktif.map((x, i) => [x.satir_id, i + 1])));
    }
    return m;
  }, [tumGrup, yerelSira]);

  // ── sayaçlar ──
  const gormeyenHatlar = useMemo(() => {
    const set = new Set<string>();
    for (const y of yayinlar) {
      if (y.bildirim_gonder && y.durum === "gonderildi") for (const h of y.onaylamayan_hatlar ?? []) set.add(h.hat_id);
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

  // Tamamlanan satır(lar)ı tekrar aktif et (diyalog; tek: istenen + iş sırası, toplu: önceki istenenle sona)
  const [yenidenHedef, setYenidenHedef] = useState<TalimatSatir[]>([]);
  const yenidenOnayla = useCallback(
    async (items: { satirId: string; istenen: number }[], sira: number | null): Promise<string | null> => {
      let yapilan = 0;
      for (const it of items) {
        const r = await satirYenidenAktifEt(it.satirId, it.istenen, sira);
        if (!r.success) {
          yenile();
          return (yapilan > 0 ? `${yapilan} satır aktif edildi, sonrası başarısız: ` : "") + hataMesaji(r);
        }
        yapilan++;
      }
      toast.success(yapilan === 1 ? "Talimat tekrar aktif edildi" : `${yapilan} talimat tekrar aktif edildi`);
      setSecili(new Set());
      yenile();
      return null;
    },
    [yenile],
  );

  /** Hatta yeni (boş) satır */
  const satirEkle = async (hatId: string) => {
    if (!plan) return;
    const r = await satirKaydet({ plan_id: plan.plan_id, hat_id: hatId });
    if (!r.success) toast.error(hataMesaji(r));
    yenile();
  };

  // ── çoklu satır seçimi (başka hatta kopyalama, toplu işlemler) ──
  const [secili, setSecili] = useState<Set<string>>(new Set());
  useEffect(() => setSecili(new Set()), [hafta]);
  // listeden kalkan satırları seçimden düşür (tamamlananlar seçilebilir: toplu tekrar aktif)
  useEffect(() => {
    setSecili((p) => {
      const gecerli = new Set(satirlar.map((s) => s.satir_id));
      const n = new Set([...p].filter((id) => gecerli.has(id)));
      return n.size === p.size ? p : n;
    });
  }, [satirlar]);
  const seciliToggle = (id: string) =>
    setSecili((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  /** Görünen sırayla seçili satır id'leri */
  const seciliSirali = useMemo(
    () => gruplar.flatMap((g) => g.satirlar).filter((s) => secili.has(s.satir_id) && blokTuru(s) !== "tamam").map((s) => s.satir_id),
    [gruplar, secili],
  );
  /** Seçili tamamlanan satırlar (toplu "Tekrar aktif et") */
  const seciliTamam = useMemo(
    () => gruplar.flatMap((g) => g.tamamlananlar).filter((s) => secili.has(s.satir_id)),
    [gruplar, secili],
  );
  const seciliKaynakHatlar = useMemo(
    () => new Set(satirlar.filter((s) => secili.has(s.satir_id)).map((s) => s.hat_id)),
    [satirlar, secili],
  );
  const hatSecimDurumu = (g: { satirlar: TalimatSatir[] }): boolean | "indeterminate" => {
    const dolu = g.satirlar.filter((s) => !satirBosMu(s) && blokTuru(s) !== "tamam");
    if (dolu.length === 0) return false;
    const n = dolu.filter((s) => secili.has(s.satir_id)).length;
    return n === 0 ? false : n === dolu.length ? true : "indeterminate";
  };
  const hatSecToggle = (g: { satirlar: TalimatSatir[] }) => {
    const dolu = g.satirlar.filter((s) => !satirBosMu(s) && blokTuru(s) !== "tamam").map((s) => s.satir_id);
    setSecili((p) => {
      const n = new Set(p);
      const hepsi = dolu.length > 0 && dolu.every((id) => n.has(id));
      for (const id of dolu) {
        if (hepsi) n.delete(id);
        else n.add(id);
      }
      return n;
    });
  };
  const gorunenDolu = useMemo(() => gruplar.flatMap((g) => g.satirlar).filter((s) => !satirBosMu(s) && blokTuru(s) !== "tamam"), [gruplar]);
  const tumunuSec = () => {
    const dolu = gorunenDolu.map((s) => s.satir_id);
    setSecili((p) => (dolu.length > 0 && dolu.every((id) => p.has(id)) ? new Set() : new Set(dolu)));
  };
  const hepsiSecili = gorunenDolu.length > 0 && gorunenDolu.every((s) => secili.has(s.satir_id));
  const bazilariSecili = !hepsiSecili && gorunenDolu.some((s) => secili.has(s.satir_id));

  /** Seçili satırları hedef hattın sonuna kopyalar (boş satırlar önce doldurulur) */
  const kopyalaHatta = useCallback(
    async (ids: string[], hedefHatId: string) => {
      const hedef = hatHaritasi.get(hedefHatId);
      if (!hedef) return;
      if (!hedef.aktif) return void toast.error(`${hedef.ad} kapalı; önce hattı açın`);
      const r = await satirlariHattaKopyala(ids, hedefHatId);
      if (!r.success) return void toast.error(hataMesaji(r));
      const doluSayi = satirlar.filter((s) => ids.includes(s.satir_id) && s.sku).length;
      const atlanan = Math.max(0, doluSayi - r.data.length);
      toast.success(`${r.data.length} satır ${hataEki(hedef.ad)} kopyalandı`);
      if (atlanan > 0) toast.warning(`${atlanan} satır atlandı: önceki/sonraki satırda aynı ürün var (arka arkaya verilemez)`);
      setSecili(new Set());
      yenile();
    },
    [hatHaritasi, yenile, satirlar],
  );

  // ── pasif ──
  const [pasifHedef, setPasifHedef] = useState<PasifHedef | null>(null);
  const [kaldirHedef, setKaldirHedef] = useState<PasifKaldirHedef | null>(null);
  const [zamanliAcik, setZamanliAcik] = useState(false);
  /** Satır başına: yalnız satır kapsamlı bekleyen işlemler */
  const satirZamanli = useMemo(() => {
    const m = new Map<string, ZamanliIslem[]>();
    for (const i of zamanliIslemler) {
      if (i.kapsam !== "satir") continue;
      for (const id of i.ids) m.set(id, [...(m.get(id) ?? []), i]);
    }
    return m;
  }, [zamanliIslemler]);
  /** Hat başına: hat, liste ve o hattın satırlarını ilgilendiren bekleyen işlemler */
  const hatZamanli = useMemo(() => {
    const m = new Map<string, ZamanliIslem[]>();
    const hatSatirlari = new Map<string, Set<string>>();
    for (const x of satirlar) {
      if (!x.hat_id) continue;
      (hatSatirlari.get(x.hat_id) ?? hatSatirlari.set(x.hat_id, new Set()).get(x.hat_id)!).add(x.satir_id);
    }
    for (const h of hatlar) {
      m.set(
        h.hat_id,
        zamanliIslemler.filter(
          (i) =>
            i.kapsam === "liste" ||
            (i.kapsam === "hat" && i.ids.includes(h.hat_id)) ||
            (i.kapsam === "satir" && i.ids.some((id) => hatSatirlari.get(h.hat_id)?.has(id))),
        ),
      );
    }
    return m;
  }, [zamanliIslemler, satirlar, hatlar]);
  const listePasifKaydi = useMemo(() => pasifKayitlari.find((k) => k.kapsam === "liste") ?? null, [pasifKayitlari]);
  const hatPasifKaydi = useMemo(() => {
    const m = new Map<string, TalimatPasifKayit>();
    for (const k of pasifKayitlari) if (k.kapsam === "hat" && k.hat_id) m.set(k.hat_id, k);
    return m;
  }, [pasifKayitlari]);
  const pasifRozetMetni = (k: TalimatPasifKayit, onek: string) =>
    `${onek} · ${k.neden || "neden yok"} · ${k.bitis && k.bitis !== "infinity" ? formatDate(k.bitis) : "süresiz"}`;
  /** Pasif kaldırma diyaloğunu hazırla (liste kapsamında tüm hatlar) */
  const kaldirAc = (kapsam: "liste" | "hat", hids: string[], baslik: string) => {
    const hedefHatlar = kapsam === "liste" ? [...tumGrup.keys()] : hids;
    const pasifSatirlar = hedefHatlar.flatMap((id) => (tumGrup.get(id) ?? []).filter((s) => s.durum === "pasif").map((s) => s.satir_id));
    setKaldirHedef({
      kapsam,
      baslik,
      hatlar: hedefHatlar,
      pasifSatirlar,
      listePasifVar: !!listePasifKaydi,
      hatPasifVar: hatPasifKaydi.size > 0,
    });
  };
  const herhangiPasif = !!listePasifKaydi || hatPasifKaydi.size > 0 || satirlar.some((s) => s.durum === "pasif" || s.etkin_pasif);

  // ── silme ──
  const [silHedef, setSilHedef] = useState<TalimatSatir | null>(null);
  const [topluSilHedef, setTopluSilHedef] = useState<{ baslik: string; aciklama: string; ids: string[] } | null>(null);
  const [topluIlerleme, setTopluIlerleme] = useState<{ yapilan: number; toplam: number } | null>(null);

  /** Temizlenecek (dolu, tamamlanmamış) satırlar; tamamlananlar korunur */
  const temizlenebilir = (liste: TalimatSatir[]) => liste.filter((s) => s.etkin_durum !== "tamamlandi" && !satirBosMu(s));

  const topluSilBaslat = async () => {
    if (!topluSilHedef || !plan || topluIlerleme) return;
    // Hat içinde sıra sıkışması nedeniyle sondan başa sil
    const harita = new Map(satirlar.map((s) => [s.satir_id, s]));
    const ids = [...topluSilHedef.ids].sort((a, b) => {
      const x = harita.get(a);
      const y = harita.get(b);
      return (x?.hat_id ?? "").localeCompare(y?.hat_id ?? "") || (y?.sira ?? 0) - (x?.sira ?? 0);
    });
    let silinen = 0;
    const hatalar: string[] = [];
    setTopluIlerleme({ yapilan: 0, toplam: ids.length });
    for (let i = 0; i < ids.length; i++) {
      const r = await satirSil(ids[i]);
      if (r.success) silinen++;
      else hatalar.push(hataMesaji(r));
      setTopluIlerleme({ yapilan: i + 1, toplam: ids.length });
    }
    setTopluIlerleme(null);
    setTopluSilHedef(null);
    setSecili(new Set());
    if (hatalar.length) toast.error(`${silinen} satır silindi, ${hatalar.length} hata: ${hatalar[0]}`);
    else toast.success(`${silinen} satır silindi`);
    yenile();
  };

  const [yayinAcik, setYayinAcik] = useState(false);
  const [kopyaOnay, setKopyaOnay] = useState(false);
  const [filtreAcik, setFiltreAcik] = useState(false);
  const [duzenleHat, setDuzenleHat] = useState<TalimatHat | null>(null);
  const [kapaliGruplar, setKapaliGruplar] = useState<Set<string>>(new Set());
  const grupToggle = (hid: string) =>
    setKapaliGruplar((p) => {
      const n = new Set(p);
      if (n.has(hid)) n.delete(hid);
      else n.add(hid);
      return n;
    });

  const filtreSayisi = (hatFiltre ? 1 : 0) + (istasyon ? 1 : 0) + toggles.size + (hatKumesi ? 1 : 0);

  const hatKapat = async (hat: TalimatHat, pasif: boolean) => {
    const r = await hatPasifYap(hat.hat_id, pasif);
    if (!r.success) toast.error(hataMesaji(r));
    else toast.success(pasif ? `${hat.ad} kapatıldı` : `${hat.ad} açıldı`);
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
      if (!hedef.hat_id || !p.has(hedef.hat_id)) return p;
      const n = new Set(p);
      n.delete(hedef.hat_id);
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
      yenidenAktif: (s) => setYenidenHedef([s]),
      pasifEt: (s) =>
        setPasifHedef({
          kapsam: "satir",
          ids: [s.satir_id],
          baslik: `${s.hat_adi ?? ""} · ${s.sira}. sıra ${s.sku ? `(${s.sku})` : ""}`,
        }),
      pasifKaldir: (s) =>
        setKaldirHedef({
          kapsam: "satir",
          satirIds: [s.satir_id],
          baslik: `${s.hat_adi ?? ""} · ${s.sira}. sıra ${s.sku ? `(${s.sku})` : ""} aktif edilecek`,
          hatlar: [],
          pasifSatirlar: [],
          listePasifVar: false,
          hatPasifVar: false,
        }),
      sil: (s) => setSilHedef(s),
    }),
    [kaydet],
  );

  // ── sürükle-bırak: aynı hatta sıralama, başka hatta kopyalama ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const [suruklenen, setSuruklenen] = useState<number | null>(null);

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    setSuruklenen(secili.has(id) ? Math.max(secili.size, 1) : 1);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setSuruklenen(null);
    if (!plan || !e.over) return;
    const aktif = satirlar.find((s) => s.satir_id === e.active.id);
    if (!aktif || !aktif.hat_id) return;
    const overId = String(e.over.id);
    const hedefBaslik = overId.startsWith("hat:");
    const hedefSatir = hedefBaslik ? undefined : satirlar.find((s) => s.satir_id === overId);
    const hedefHatId = hedefBaslik ? overId.slice(4) : hedefSatir?.hat_id;
    if (!hedefHatId) return;

    // Başka hatta bırakıldı: seçili satırları (veya yalnız sürüklenen satırı) kopyala
    if (hedefHatId !== aktif.hat_id) {
      const ids = secili.has(aktif.satir_id) ? seciliSirali : [aktif.satir_id];
      await kopyalaHatta(ids, hedefHatId);
      return;
    }

    // Aynı hat: sıralama
    if (hedefBaslik || e.active.id === e.over.id || !hedefSatir) return;
    // Yalnız aktif blok içinde sıralanır; tamamlanan/pasif satırlara bırakmak geçersiz
    if (blokTuru(aktif) !== "aktif" || blokTuru(hedefSatir) !== "aktif") return;
    const hid = aktif.hat_id;
    const tumHat = tumGrup.get(hid) ?? [];
    const tam = yerelSira[hid] ?? [...tumHat].sort((a, b) => a.sira - b.sira).map((s) => s.satir_id);
    const hamYeni = arrayMove(tam, tam.indexOf(aktif.satir_id), tam.indexOf(hedefSatir.satir_id));
    // Aktifler yeni sırayla başa, sonra tamamlananlar, sonra pasifler (DB'de aktifler 1..k)
    const tur = new Map(tumHat.map((x) => [x.satir_id, blokTuru(x)]));
    const yeni = [
      ...hamYeni.filter((id) => tur.get(id) === "aktif"),
      ...hamYeni.filter((id) => tur.get(id) === "tamam"),
      ...hamYeni.filter((id) => tur.get(id) === "pasif"),
    ];
    setYerelSira((p) => ({ ...p, [hid]: yeni }));
    const r = await satirSiralaHat(plan.plan_id, hid, yeni);
    if (!r.success) {
      toast.error(hataMesaji(r));
      setYerelSira((p) => {
        const n = { ...p };
        delete n[hid];
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

  const tumTemizlenebilir = temizlenebilir(satirlar);
  const kopyaHedefHatlari = hatlar.filter((h) => h.aktif && !(seciliKaynakHatlar.size === 1 && seciliKaynakHatlar.has(h.hat_id)));

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {/* Başlık: büyük ana buton solda, ikincil işlemler sağda kompakt */}
        <div className="flex flex-wrap items-center gap-4">
          {editable && plan && <HatEkle onDone={yenile} />}
          <div>
            <h1 className="text-2xl font-bold text-vw-dark">Mavi Yaka Görev İş Talimatları</h1>
            <p className="text-sm text-muted-foreground">
              Haftalık hat planı{!planner && " (salt okunur)"}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link href="/ops/board">
                <ArrowLeft className="mr-1 h-4 w-4" /> Geri
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/ops/board/mavi-yaka/ek-seanslar">
                <ListChecks className="mr-1.5 h-4 w-4" /> Açılan Ek Seanslar
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/ops/board/mavi-yaka/ek-seanslar/toplam">
                <Sigma className="mr-1.5 h-4 w-4" /> Toplam Ek Seanslar
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
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setZamanliAcik(true)}>
                      <Clock className="mr-2 h-4 w-4" /> Zamanlanmış işlemler
                      {zamanliIslemler.length > 0 && (
                        <span className="ml-auto rounded-full bg-vw-deep px-1.5 text-[11px] text-white">{zamanliIslemler.length}</span>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setPasifHedef({ kapsam: "liste", ids: [], baslik: "Tüm liste (bütün hatlar) pasif edilecek" })}
                    >
                      <PauseCircle className="mr-2 h-4 w-4" /> Tüm listeyi pasif et
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!herhangiPasif}
                      onSelect={() => kaldirAc("liste", [], "Tüm listenin pasifi kaldırılacak")}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" /> Tüm listenin pasifini kaldır
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={tumTemizlenebilir.length === 0}
                      className="text-[#c0424f] focus:text-[#c0424f]"
                      onClick={() =>
                        setTopluSilHedef({
                          baslik: "Tüm liste temizlensin mi?",
                          aciklama: `Bu haftanın iş talimatı listesindeki ${tumTemizlenebilir.length} dolu satır silinecek (hatlar boş satırla kalır). `,
                          ids: tumTemizlenebilir.map((s) => s.satir_id),
                        })
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Tüm listeyi temizle
                    </DropdownMenuItem>
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
              {planner ? "Taslak bir plan oluşturup hatların satırlarını doldurarak başlayın." : "Planlama yetkisi olan bir kullanıcı plan oluşturduğunda burada görünecek."}
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
              {gormeyenHatlar.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHatKumesi(hatKumesi ? null : gormeyenHatlar)}
                  className={cn(
                    "rounded-full border px-3 py-1 font-medium",
                    hatKumesi ? "border-[#c0424f] bg-[#c0424f] text-white" : "border-[#c0424f]/40 bg-[#fbdde1] text-[#c0424f] hover:bg-[#f7ccd2]",
                  )}
                >
                  {gormeyenHatlar.length} hat değişiklikleri görmedi
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
                {hatlar.filter((h) => h.aktif).length} hat · {satirlar.filter((s) => !satirBosMu(s)).length} dolu satır
              </span>
            </div>

            {/* Arama + Filtreler (tek arama kutusu; tüm filtreler yan panelde) */}
            <div className="mb-4 flex flex-wrap items-center gap-2 border-b pb-3">
              <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={arama}
                  onChange={(e) => setArama(e.target.value)}
                  placeholder="Hat, ürün kodu veya adı ara"
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
              {hatKumesi && (
                <span className="rounded-full border border-[#c0424f] px-3 py-0.5 text-xs font-medium text-[#c0424f]">
                  Görmeyen {hatKumesi.length} hat
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
                    <div className="mb-1 text-xs font-medium">Hat</div>
                    <select
                      value={hatFiltre}
                      onChange={(e) => setHatFiltre(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    >
                      <option value="">Tüm hatlar</option>
                      {hatlar.map((h) => (
                        <option key={h.hat_id} value={h.hat_id}>
                          ● {h.ad}
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
                      {TALIMAT_ISTASYONLAR.filter((i) => i.value !== "kesim").map((i) => (
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

            {editable && gorunenDolu.length > 0 && (
              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-vw-dark">
                <Checkbox
                  checked={hepsiSecili ? true : bazilariSecili ? "indeterminate" : false}
                  onCheckedChange={tumunuSec}
                  aria-label="Tüm satırları seç"
                  className="h-5 w-5 bg-white"
                />
                Tüm dolu satırları seç{filtreAktif ? ` (görünen ${gorunenDolu.length})` : ""}
                <span className="text-xs text-muted-foreground">
                  · Satırları işaretleyip başka hattın başlığına sürükleyin veya &quot;Başka hatta kopyala&quot; deyin
                </span>
              </label>
            )}

            {/* Tablo */}
            <DndContext
              id="mavi-yaka-dnd"
              sensors={sensors}
              collisionDetection={cakisma}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragCancel={() => setSuruklenen(null)}
            >
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
                          {hatlar.length === 0 ? "Henüz hat yok. “Hat Ekle” ile başlayın." : "Filtreye uyan satır yok."}
                        </td>
                      </tr>
                    </tbody>
                  ) : (
                    gruplar.map((g) => {
                      const hat = g.hat;
                      const tamListe = tumGrup.get(hat.hat_id) ?? [];
                      const dolu = tamListe.filter((s) => !satirBosMu(s));
                      const aktifSayisi = g.aktifler.length;
                      const tamamSayisi = g.tamamlananlar.length;
                      const hatPasif = dolu.length > 0 && dolu.every((s) => s.etkin_pasif);
                      const pasifSayisi = dolu.filter((x) => x.etkin_pasif).length;
                      const pasifKaydi = hatPasifKaydi.get(hat.hat_id);
                      const hatDuzenlenebilir = editable && hat.aktif;
                      const secimDurumu = hatSecimDurumu(g);
                      const temiz = temizlenebilir(tamListe);
                      return (
                        <tbody key={hat.hat_id} className={cn(!hat.aktif && "opacity-70")}>
                          <HatDropRow hatId={hat.hat_id} disabled={!editable || !hat.aktif}>
                            {(isOver) => (
                              <td
                                colSpan={11}
                                style={isOver ? undefined : { backgroundColor: hatRengi(hat), color: HAT_YAZI_RENGI }}
                                className={cn(
                                  // Hat başlığı listeyle birlikte kayar; yalnız sütun başlıkları sabit kalır
                                  "px-3 py-2 transition-colors",
                                  isOver ? "bg-[#b1d286] text-vw-dark ring-2 ring-inset ring-[#3caa35]" : "text-white",
                                )}
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => grupToggle(hat.hat_id)}
                                    aria-label={kapaliGruplar.has(hat.hat_id) ? "Hattı aç" : "Hattı kapat"}
                                    className="rounded p-0.5 hover:bg-black/20"
                                  >
                                    <ChevronDown className={cn("h-4 w-4 transition-transform", kapaliGruplar.has(hat.hat_id) && "-rotate-90")} />
                                  </button>
                                  {hatDuzenlenebilir && (
                                    <Checkbox
                                      checked={secimDurumu}
                                      onCheckedChange={() => hatSecToggle(g)}
                                      aria-label={`${hat.ad} dolu satırlarını seç`}
                                      className="h-5 w-5 bg-white"
                                    />
                                  )}
                                  <span className="text-sm font-bold">{hat.ad}</span>
                                  <Badge variant="outline" className={cn("text-[11px]", isOver ? "border-vw-side/60 text-vw-deep" : "border-white/70 bg-white/15 text-white")}>
                                    {HAT_TUR_LABEL[hat.tur]}
                                  </Badge>
                                  {!hat.aktif && <Badge className="border-0 bg-[#cfd8dc] text-[#546e7a]">Hat kapalı</Badge>}
                                  {(() => {
                                    if (pasifKaydi) return <Badge className="border-0 bg-[#cfd8dc] text-[#546e7a]">{pasifRozetMetni(pasifKaydi, "Pasif")}</Badge>;
                                    if (listePasifKaydi) return <Badge className="border-0 bg-[#cfd8dc] text-[#546e7a]">{pasifRozetMetni(listePasifKaydi, "Pasif (tüm liste)")}</Badge>;
                                    if (hatPasif) return <Badge className="border-0 bg-[#cfd8dc] text-[#546e7a]">Pasif</Badge>;
                                    if (pasifSayisi > 0) return <Badge className="border-0 bg-[#eceff1] text-[#546e7a]">{pasifSayisi} satır pasif</Badge>;
                                    return null;
                                  })()}
                                  {(() => {
                                    const hz = hatZamanli.get(hat.hat_id) ?? [];
                                    if (hz.length === 0) return null;
                                    return (
                                      <Badge
                                        title={hz.map((z) => zamanliOzet(z)).join(" | ")}
                                        className="cursor-pointer border-0 bg-[#e8eaf6] text-[#283593]"
                                        onClick={() => setZamanliAcik(true)}
                                      >
                                        <Clock className="mr-1 h-3 w-3" /> {hz.length} zamanlı
                                      </Badge>
                                    );
                                  })()}
                                  <span className={cn("text-xs", isOver ? "text-muted-foreground" : "font-medium text-white/90")}>{aktifSayisi} satır{tamamSayisi > 0 ? ` · ${tamamSayisi} tamamlandı` : ""}</span>
                                  {isOver && <span className="text-xs font-semibold text-[#2f7d66]">Buraya bırak: kopyala</span>}
                                  {hatDuzenlenebilir && (
                                    <div className="ml-auto flex items-center gap-1">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 border-white bg-white text-xs font-semibold hover:bg-white/90"
                                        style={{ color: hatRengi(hat) }}
                                        onClick={() => satirEkle(hat.hat_id)}
                                      >
                                        <Plus className="mr-1 h-3.5 w-3.5" /> satır
                                      </Button>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className={cn("h-7 w-7", !isOver && "text-white hover:bg-white/20 hover:text-white")} aria-label={`${hat.ad} işlemleri`}>
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-60">
                                          <DropdownMenuItem onSelect={() => setDuzenleHat(hat)}>
                                            <Pencil className="mr-2 h-4 w-4" /> Hat adını / türünü düzenle
                                          </DropdownMenuItem>
                                          {pasifKaydi || hatPasif || listePasifKaydi || tamListe.some((x) => x.durum === "pasif") ? (
                                            <DropdownMenuItem onSelect={() => kaldirAc("hat", [hat.hat_id], `${hat.ad} pasifi kaldırılacak`)}>
                                              <PlayCircle className="mr-2 h-4 w-4" /> Pasifi kaldır
                                            </DropdownMenuItem>
                                          ) : null}
                                          {!hatPasif && !pasifKaydi && (
                                            <DropdownMenuItem
                                              onSelect={() => setPasifHedef({ kapsam: "hat", ids: [hat.hat_id], baslik: `${hat.ad} tüm listesi pasif edilecek` })}
                                            >
                                              <EyeOff className="mr-2 h-4 w-4" /> Pasif et (tarih seç)
                                            </DropdownMenuItem>
                                          )}
                                          <DropdownMenuItem
                                            disabled={temiz.length === 0}
                                            className="text-[#c0424f] focus:text-[#c0424f]"
                                            onSelect={() =>
                                              setTopluSilHedef({
                                                baslik: `${hat.ad} satırları temizlensin mi?`,
                                                aciklama: `${hat.ad} hattındaki ${temiz.length} dolu satır silinecek (hat 1 boş satırla kalır). `,
                                                ids: temiz.map((s) => s.satir_id),
                                              })
                                            }
                                          >
                                            <Trash2 className="mr-2 h-4 w-4" /> Satırları temizle
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem onSelect={() => void hatKapat(hat, true)}>
                                            <PauseCircle className="mr-2 h-4 w-4" /> Hattı kapat (kalıcı pasif)
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  )}
                                  {editable && !hat.aktif && (
                                    <Button variant="outline" size="sm" className="ml-auto h-7 bg-white text-xs" onClick={() => void hatKapat(hat, false)}>
                                      <PlayCircle className="mr-1 h-3.5 w-3.5" /> Hattı aç
                                    </Button>
                                  )}
                                </div>
                              </td>
                            )}
                          </HatDropRow>
                          <SortableContext items={g.aktifler.map((s) => s.satir_id)} strategy={verticalListSortingStrategy}>
                            {!kapaliGruplar.has(hat.hat_id) &&
                              [
                                { tur: "aktif" as const, liste: g.aktifler, baslik: null },
                                { tur: "tamam" as const, liste: g.tamamlananlar, baslik: "Tamamlananlar" },
                                { tur: "pasif" as const, liste: g.pasifler, baslik: "Pasif" },
                              ].map((blok) => (
                                <Fragment key={blok.tur}>
                                  {blok.baslik && blok.liste.length > 0 && (
                                    <tr>
                                      <td
                                        colSpan={11}
                                        className={cn(
                                          "border-y px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
                                          blok.tur === "tamam" ? "bg-[#e3ecd2] text-[#2f8a2a]" : "bg-[#eceff1] text-[#546e7a]",
                                        )}
                                      >
                                        {blok.baslik} ({blok.liste.length})
                                      </td>
                                    </tr>
                                  )}
                                  {blok.liste.map((s) => (
                                    <SatirRow
                                      key={s.satir_id}
                                      s={s}
                                      editable={hatDuzenlenebilir}
                                      // Sıra numarası yalnız aktiflerde (1..n)
                                      siraNo={blok.tur === "aktif" ? (siraHaritasi.get(hat.hat_id)?.get(s.satir_id) ?? s.sira) : null}
                                      depoStoklari={s.sku ? stoklar[s.sku] : undefined}
                                      islem={islem}
                                      sirali={blok.tur === "aktif"}
                                      parlak={parlayanSatir === s.satir_id}
                                      secili={secili.has(s.satir_id)}
                                      hatRenk={hatRengi(hat)}
                                      hatRenkAcik={hatRengiAcik(hat, 0.07)}
                                      zamanli={satirZamanli.get(s.satir_id)}
                                      engelliSkular={engelliSkular.get(s.satir_id)}
                                      onSecToggle={satirBosMu(s) ? undefined : () => seciliToggle(s.satir_id)}
                                    />
                                  ))}
                                </Fragment>
                              ))}
                          </SortableContext>
                        </tbody>
                      );
                    })
                  )}
                </table>
              </div>
            </DndContext>

            {suruklenen != null && (
              <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-vw-dark px-4 py-2 text-sm font-medium text-white shadow-lg">
                {suruklenen} satır sürükleniyor — başka hatta kopyalamak için o hattın başlığına bırakın
              </div>
            )}

            {editable && (seciliSirali.length > 0 || seciliTamam.length > 0) && (
              <div className="sticky bottom-3 z-30 flex flex-wrap items-center gap-2 rounded-lg border border-vw-side bg-vw-light px-3 py-2 shadow-lg">
                <span className="text-sm font-medium text-vw-dark">{seciliSirali.length + seciliTamam.length} satır seçildi</span>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" className="h-9" onClick={() => setSecili(new Set())}>
                    Seçimi temizle
                  </Button>
                  {seciliTamam.length > 0 && (
                    <Button size="sm" className="h-9 bg-[#3caa35] text-white hover:bg-[#2f8a2a]" onClick={() => setYenidenHedef(seciliTamam)}>
                      <RotateCcw className="mr-1.5 h-4 w-4" /> Seçilenleri tekrar aktif et ({seciliTamam.length})
                    </Button>
                  )}
                  {seciliSirali.length > 0 && (<>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="h-9 bg-vw-deep text-white hover:bg-vw-dark">
                        <CopyPlus className="mr-1.5 h-4 w-4" /> Başka hatta kopyala <ChevronDown className="ml-1 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                      {kopyaHedefHatlari.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">Hedef hat yok</div>
                      ) : (
                        kopyaHedefHatlari.map((h) => (
                          <DropdownMenuItem key={h.hat_id} onSelect={() => void kopyalaHatta(seciliSirali, h.hat_id)}>
                            <HatNokta hat={h} className="mr-2" />
                            {h.ad}
                            <span className="ml-auto text-[11px] text-muted-foreground">{HAT_TUR_LABEL[h.tur]}</span>
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() =>
                      setPasifHedef({ kapsam: "satir", ids: seciliSirali, baslik: `${seciliSirali.length} satır pasif edilecek` })
                    }
                  >
                    <EyeOff className="mr-1.5 h-4 w-4" /> Seçilenleri pasif et
                  </Button>
                  {satirlar.some((x) => secili.has(x.satir_id) && x.durum === "pasif") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() =>
                        setKaldirHedef({
                          kapsam: "satir",
                          satirIds: satirlar.filter((x) => secili.has(x.satir_id) && x.durum === "pasif").map((x) => x.satir_id),
                          baslik: `${satirlar.filter((x) => secili.has(x.satir_id) && x.durum === "pasif").length} pasif satır aktif edilecek`,
                          hatlar: [],
                          pasifSatirlar: [],
                          listePasifVar: false,
                          hatPasifVar: false,
                        })
                      }
                    >
                      <PlayCircle className="mr-1.5 h-4 w-4" /> Seçilenleri aktif et
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="h-9 bg-[#c0424f] text-white hover:bg-[#a63744]"
                    onClick={() =>
                      setTopluSilHedef({
                        baslik: `${seciliSirali.length} satır silinsin mi?`,
                        aciklama: `Seçili ${seciliSirali.length} satır silinecek. `,
                        ids: seciliSirali,
                      })
                    }
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" /> Seçilenleri sil
                  </Button>
                  </>)}
                </div>
              </div>
            )}

            <YenidenAktifDialog
              hedefler={yenidenHedef}
              aktifSayisi={yenidenHedef.length === 1 ? (gruplar.find((g) => g.hat.hat_id === yenidenHedef[0].hat_id)?.aktifler.length ?? 0) : 0}
              onClose={() => setYenidenHedef([])}
              onayla={yenidenOnayla}
            />

            <YayinGecmisi yayinlar={yayinlar} editable={editable} onChanged={yenile} hatlar={hatlar} />
          </>
        )}

        {/* Diyaloglar */}
        {plan && (
          <>
            <YayinDialog open={yayinAcik} plan={plan} gelecekHafta={gelecekHafta} onClose={() => setYayinAcik(false)} onDone={yenile} />
            <PasifDialog planId={plan.plan_id} hedef={pasifHedef} onClose={() => setPasifHedef(null)} onDone={yenile} />
            <PasifKaldirDialog planId={plan.plan_id} hedef={kaldirHedef} onClose={() => setKaldirHedef(null)} onDone={yenile} />
            <ZamanliListeDialog
              open={zamanliAcik}
              onOpenChange={setZamanliAcik}
              islemler={zamanliIslemler}
              hatlar={hatlar}
              satirlar={satirlar}
              onDone={yenile}
            />
          </>
        )}
        <HatDuzenleDialog hat={duzenleHat} onClose={() => setDuzenleHat(null)} onDone={yenile} />

        <AlertDialog open={!!silHedef} onOpenChange={(o) => !o && setSilHedef(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Satır silinsin mi?</AlertDialogTitle>
              <AlertDialogDescription>
                {silHedef?.hat_adi} · {silHedef?.sira}. sıra {silHedef?.sku ? `(${silHedef.sku})` : ""} silinecek, diğer sıralar yukarı kayacak.
                {silHedef && (tumGrup.get(silHedef.hat_id ?? "") ?? []).length <= 1 && (
                  <span className="mt-1 block font-medium text-[#b8650c]">Hattın son satırı: hat 1 boş satırla kalır.</span>
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

        <AlertDialog open={!!topluSilHedef} onOpenChange={(o) => !o && !topluIlerleme && setTopluSilHedef(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{topluSilHedef?.baslik}</AlertDialogTitle>
              <AlertDialogDescription>
                {topluSilHedef?.aciklama}
                Tamamlanan işler (Tamamlananlar listesi), seanslar, üretim adetleri, stoklar ve talepler SİLİNMEZ. Talebe bağlı satırlar silinince ilgili talepler tekrar &apos;Açık&apos; olur.
                Plan yayındaysa değişiklik bir sonraki Yayınla ile tabletlere gider.
                {topluIlerleme && (
                  <span className="mt-2 block font-medium text-vw-dark">
                    {topluIlerleme.yapilan}/{topluIlerleme.toplam} siliniyor…
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={!!topluIlerleme}>Vazgeç</AlertDialogCancel>
              <AlertDialogAction
                disabled={!!topluIlerleme}
                className="bg-[#c0424f] text-white hover:bg-[#a63744]"
                onClick={(e) => {
                  e.preventDefault();
                  void topluSilBaslat();
                }}
              >
                {topluIlerleme ? "Siliniyor…" : "Temizle"}
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

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  EyeOff,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Send,
  UserPlus,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { gunEkle, personeleGoreGrupla, satirFiltrele } from "@/lib/talimat/helpers";
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

export function MaviYakaClient({ hafta, buHafta, plan, satirlar, yayinlar, personeller, stoklar, planner }: Props) {
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
        return { pid, ad: liste[0]?.personel_adi ?? pid, istasyon: liste[0]?.personel_istasyon ?? null, satirlar: sirali };
      })
      .sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  }, [gorunenSatirlar, yerelSira]);

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
    const r = await satirKaydet({ plan_id: plan.plan_id, personel_id: personelId });
    if (!r.success) toast.error(hataMesaji(r));
    yenile();
  };

  const [pasifHedef, setPasifHedef] = useState<PasifHedef | null>(null);
  const [silHedef, setSilHedef] = useState<TalimatSatir | null>(null);
  const [yayinAcik, setYayinAcik] = useState(false);
  const [kopyaOnay, setKopyaOnay] = useState(false);

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

  const [personelAcik, setPersonelAcik] = useState(false);
  const eklenebilir = personeller.filter((p) => !eklenmisPersonel.has(p.user_id));

  const tumListePasif = !!plan && satirlar.length > 0 && satirlar.every((s) => s.etkin_pasif);

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {/* Başlık */}
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/ops/board">
              <ArrowLeft className="mr-1 h-4 w-4" /> Geri
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-vw-dark">Mavi Yaka Görev İş Talimatları</h1>
            <p className="text-sm text-muted-foreground">
              Haftalık personel planı{!planner && " (salt okunur)"}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/talepler">
                <ClipboardList className="mr-1.5 h-4 w-4" /> Talepler
              </Link>
            </Button>
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

          {planner && plan && plan.durum !== "pasif" && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Popover open={guncelAcik} onOpenChange={setGuncelAcik}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Check className="mr-1.5 h-4 w-4" /> Güncel işaretle
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 space-y-2" align="end">
                  <div className="text-sm font-medium">Kaç gün güncel kalsın?</div>
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
                  <Button size="sm" className="w-full bg-vw-deep text-white hover:bg-vw-dark" onClick={guncelle}>
                    İşaretle
                  </Button>
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => setKopyaOnay(true)}>
                <Copy className="mr-1.5 h-4 w-4" /> Bu haftayı kopyala → yeni hafta
              </Button>
              <Button
                size="sm"
                disabled={busy}
                className="bg-vw-deep text-white hover:bg-vw-dark"
                onClick={() => setYayinAcik(true)}
              >
                <Send className="mr-1.5 h-4 w-4" /> Yayınla
                {plan.degisen_satir_sayisi > 0 && (
                  <span className="ml-1.5 rounded-full bg-white/25 px-1.5 text-[11px]">{plan.degisen_satir_sayisi}</span>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={async () => {
                  const r = await talimatYayinla({ planId: plan.plan_id, bildirimGonder: false, hedef: plan.durum === "taslak" ? "herkes" : "degisenler" });
                  if (!r.success) toast.error(hataMesaji(r));
                  else toast.success("Liste bildirimsiz yenilendi");
                  yenile();
                }}
              >
                Bildirimsiz yenile
              </Button>
            </div>
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

            {/* Filtre çubuğu */}
            <Card className="gap-2 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={arama}
                    onChange={(e) => setArama(e.target.value)}
                    placeholder="Personel, ürün kodu veya adı ara"
                    className="h-9 pl-8"
                  />
                </div>
                <select
                  value={personelFiltre}
                  onChange={(e) => setPersonelFiltre(e.target.value)}
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
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
                <select
                  value={istasyon}
                  onChange={(e) => setIstasyon(e.target.value)}
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">Tüm istasyonlar</option>
                  {TALIMAT_ISTASYONLAR.map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.label}
                    </option>
                  ))}
                </select>
                {filtreAktif && (
                  <Button variant="ghost" size="sm" onClick={filtreTemizle}>
                    <X className="mr-1 h-4 w-4" /> Temizle
                  </Button>
                )}
              </div>
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
                {personelKumesi && (
                  <span className="rounded-full border border-[#c0424f] px-3 py-1 text-xs font-medium text-[#c0424f]">
                    Görmeyen {personelKumesi.length} personel
                  </span>
                )}
              </div>
            </Card>

            {/* Personel ekle + toplu pasif */}
            {editable && (
              <div className="flex flex-wrap items-center gap-2">
                <Popover open={personelAcik} onOpenChange={setPersonelAcik}>
                  <PopoverTrigger asChild>
                    <Button size="sm" className="bg-vw-primary text-vw-dark hover:bg-vw-side">
                      <UserPlus className="mr-1.5 h-4 w-4" /> Personel ekle
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Personel ara..." />
                      <CommandList>
                        <CommandEmpty>Eklenebilecek personel yok</CommandEmpty>
                        <CommandGroup>
                          {eklenebilir.map((p) => (
                            <CommandItem
                              key={p.user_id}
                              value={`${p.full_name} ${p.user_id}`}
                              onSelect={async () => {
                                setPersonelAcik(false);
                                await satirEkle(p.user_id);
                              }}
                            >
                              <span className="flex-1 truncate">{p.full_name}</span>
                              <span className="text-[11px] text-muted-foreground">{p.station ?? p.role}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {tumListePasif ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const r = await talimatPasifKaldir({ kapsam: "liste", planId: plan.plan_id });
                      if (!r.success) toast.error(hataMesaji(r));
                      else toast.success("Liste pasifi kaldırıldı");
                      yenile();
                    }}
                  >
                    <PlayCircle className="mr-1.5 h-4 w-4" /> Tüm listeyi aktifleştir
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPasifHedef({ kapsam: "liste", ids: [], baslik: "Tüm liste (bütün personel) pasif edilecek" })}
                  >
                    <PauseCircle className="mr-1.5 h-4 w-4" /> Tüm listeyi pasif et
                  </Button>
                )}
              </div>
            )}

            {/* Tablo */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <table className="w-full min-w-[1180px] border-collapse">
                  <thead className="bg-vw-light text-left text-xs font-semibold uppercase tracking-wide text-vw-deep">
                    <tr>
                      <th className="px-2 py-2">Sıra</th>
                      <th className="px-2 py-2">İstasyon</th>
                      <th className="px-2 py-2">Ürün Kodu</th>
                      <th className="px-2 py-2">Ürün Adı</th>
                      <th className="px-2 py-2 text-right">Güncel Stok</th>
                      <th className="px-2 py-2">Üretim Miktarı</th>
                      <th className="px-2 py-2">İstenen Miktar</th>
                      <th className="px-2 py-2 text-right">Fark</th>
                      <th className="px-2 py-2">Not</th>
                      <th className="px-2 py-2">Durum</th>
                      <th className="px-2 py-2" />
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
                          <tr className="border-y bg-vw-primary/30">
                            <td colSpan={11} className="px-3 py-2">
                              <div className="flex flex-wrap items-center gap-2">
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
                            {g.satirlar.map((s) => {
                              const komsular = tamListe.filter((x) => x.sira === s.sira - 1 || x.sira === s.sira + 1);
                              const engelli: Record<string, string> = {};
                              for (const k of komsular) {
                                if (k.sku) engelli[k.sku] = k.sira < s.sira ? "Önceki satırda aynı ürün var" : "Sonraki satırda aynı ürün var";
                              }
                              return (
                                <SatirRow
                                  key={s.satir_id}
                                  s={s}
                                  editable={editable}
                                  engelli={engelli}
                                  depoStoklari={s.sku ? stoklar[s.sku] : undefined}
                                  islem={islem}
                                  sirali
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
              <AlertDialogTitle>Satır silinsin mi?</AlertDialogTitle>
              <AlertDialogDescription>
                {silHedef?.personel_adi} · {silHedef?.sira}. sıra {silHedef?.sku ? `(${silHedef.sku})` : ""} silinecek, diğer sıralar yukarı kayacak.
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

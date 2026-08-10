"use client";

import { useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { OlcuEkleDialog } from "./olcu-ekle-dialog";
import { KonteynerGorunum } from "./konteyner-gorunum";
import { plandanSevkiyatOlustur, planKaydet, type PlanlamaUrun } from "../actions";
import type { KonteynerTipi } from "@/lib/shipment-settings-types";
import type { PackSonuc, PackUrun } from "@/lib/packing/types";
import type { WorkerCikti } from "@/lib/packing/worker";
import { dizilimTablosu } from "@/lib/packing/dizilim";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Container, Lock, LockOpen, Play, Ruler, Search, Settings2, TriangleAlert, Loader2, Truck,
} from "lucide-react";

const RENKLER = ["#9e9e9e", "#4fc3f7", "#d7bb91", "#a1887f", "#ffb74d", "#81c784",
                 "#ba68c8", "#f06292", "#4db6ac", "#ffd54f"];

interface Secim {
  sku: string;
  hedef: string;
  kilitli: boolean;
}

export function PlanlamaClient({
  urunler: ilkUrunler,
  konteynerTipleri,
}: {
  urunler: PlanlamaUrun[];
  konteynerTipleri: KonteynerTipi[];
}) {
  const [urunler, setUrunler] = useState(ilkUrunler);
  const [tip, setTip] = useState(
    konteynerTipleri.find((k) => k.type === "40ft HC")?.type ?? konteynerTipleri[0]?.type ?? "",
  );
  const [arama, setArama] = useState("");
  const [secimler, setSecimler] = useState<Map<string, Secim>>(new Map());
  const [olcuUrun, setOlcuUrun] = useState<PlanlamaUrun | null>(null);

  const [calisiyor, setCalisiyor] = useState(false);
  const [ilerleme, setIlerleme] = useState(0);
  const [sonuc, setSonuc] = useState<PackSonuc | null>(null);
  const [uyarilar, setUyarilar] = useState<string[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const router = useRouter();
  const [ulke, setUlke] = useState("USA");
  const [donusturuluyor, setDonusturuluyor] = useState(false);

  // Gelişmiş ayarlar — sahadaki tercihe göre oynanabilsin
  const [butce, setButce] = useState("15");
  const [minBlok, setMinBlok] = useState("6");
  const [blokCezasi, setBlokCezasi] = useState("80000");
  const [enAzKoli, setEnAzKoli] = useState("24");

  const kont = useMemo(() => {
    const k = konteynerTipleri.find((x) => x.type === tip);
    return {
      uzunluk: k?.ic_uzunluk ?? 1200,
      genislik: k?.ic_genislik ?? 235,
      yukseklik: k?.ic_yukseklik ?? 269,
      maxYukKg: k?.max_yuk_kg ?? 0,
    };
  }, [tip, konteynerTipleri]);

  const olculu = (u: PlanlamaUrun) => u.boy != null && u.en != null && u.yuk != null;

  const gosterilen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr");
    if (!q) return urunler;
    return urunler.filter(
      (u) =>
        u.sku.toLocaleLowerCase("tr").includes(q) ||
        (u.urun_adi ?? "").toLocaleLowerCase("tr").includes(q),
    );
  }, [urunler, arama]);

  const secili = useMemo(
    () => urunler.filter((u) => secimler.has(u.sku)),
    [urunler, secimler],
  );

  const secimDegistir = (u: PlanlamaUrun, acik: boolean) => {
    setSecimler((p) => {
      const n = new Map(p);
      if (acik) n.set(u.sku, { sku: u.sku, hedef: "", kilitli: false });
      else n.delete(u.sku);
      return n;
    });
  };

  const alanGuncelle = (sku: string, alan: "hedef" | "kilitli", deger: string | boolean) => {
    setSecimler((p) => {
      const n = new Map(p);
      const s = n.get(sku);
      if (s) n.set(sku, { ...s, [alan]: deger } as Secim);
      return n;
    });
  };

  const calistir = () => {
    if (secili.length === 0) {
      toast.error("En az bir ürün seçin");
      return;
    }
    const olcusuz = secili.filter((u) => !olculu(u));
    if (olcusuz.length > 0) {
      toast.error(`Ölçüsü olmayan ürün var: ${olcusuz.map((u) => u.sku).join(", ")}`);
      return;
    }

    const packUrunler: PackUrun[] = secili.map((u, i) => {
      const s = secimler.get(u.sku)!;
      const girilen = Number(s.hedef.replace(",", "."));
      // Hedef girilmemişse serbest ürün için üst sınır olarak geniş bir değer;
      // konteynere sığdığı kadarı yüklenir
      const hedef = Number.isFinite(girilen) && girilen > 0 ? Math.trunc(girilen) : 2000;
      return {
        sku: u.sku,
        ad: u.urun_adi,
        boy: u.boy!, en: u.en!, yuk: u.yuk!,
        koliAdedi: u.koli_adedi ?? 1,
        koliAgirlik: u.koli_agirlik ?? 0,
        hedef,
        kilitli: s.kilitli && Number.isFinite(girilen) && girilen > 0,
        // Her seçilen ürün plana girsin; kilitli ürünlerde asgari zaten hedeftir
        enAz: s.kilitli ? hedef : Math.max(0, Number(enAzKoli) || 0),
        renk: RENKLER[i % RENKLER.length],
      };
    });

    setCalisiyor(true);
    setIlerleme(0);
    setUyarilar([]);

    workerRef.current?.terminate();
    const w = new Worker(new URL("@/lib/packing/worker.ts", import.meta.url));
    workerRef.current = w;

    w.onmessage = (e: MessageEvent<WorkerCikti>) => {
      const m = e.data;
      if (m.tip === "ilerleme") setIlerleme(m.yuzde);
      else if (m.tip === "hata") {
        toast.error(m.mesaj);
        setCalisiyor(false);
        w.terminate();
      } else {
        setSonuc(m.sonuc);
        setUyarilar(m.dogrulama.gecerli ? [] : m.dogrulama.hatalar);
        setCalisiyor(false);
        w.terminate();
        // Sistemin bulduğu adetleri kutulara yaz — kullanıcı buradan oynayabilsin
        setSecimler((p) => {
          const n = new Map(p);
          for (const [sku, s] of n) {
            const y = m.sonuc.yuklenen[sku] ?? 0;
            if (!s.kilitli) n.set(sku, { ...s, hedef: String(y) });
          }
          return n;
        });
      }
    };

    w.postMessage({
      urunler: packUrunler,
      konteyner: kont,
      ayar: {
        butceMs: Math.max(2, Number(butce) || 15) * 1000,
        minBlok: Math.max(1, Number(minBlok) || 6),
        blokCezasi: Math.max(0, Number(blokCezasi) || 80000),
      },
    });
  };

  const sevkiyataDonustur = async () => {
    if (!sonuc) return;
    setDonusturuluyor(true);

    const kalemler = secili
      .map((u) => {
        const koli = sonuc.yuklenen[u.sku] ?? 0;
        return {
          sku: u.sku,
          urun_adi: u.urun_adi,
          koli,
          adet: koli * (u.koli_adedi ?? 1),
          boy: u.boy!, en: u.en!, yuk: u.yuk!,
          koli_agirlik: u.koli_agirlik ?? 0,
        };
      })
      .filter((k) => k.koli > 0);

    // Plan kaydı — sevkiyatla ilişkilendirilsin, sonradan geri bakılabilsin
    const kayit = await planKaydet({
      ad: `${tip} planı`,
      konteyner_tipi: tip,
      ic_uzunluk: kont.uzunluk,
      ic_genislik: kont.genislik,
      ic_yukseklik: kont.yukseklik,
      girdi: { urunler: secili.map((u) => u.sku), secimler: [...secimler.values()] },
      sonuc: { bloklar: sonuc.bloklar, yuklenen: sonuc.yuklenen },
      doluluk_yuzde: sonuc.dolulukYuzde,
      toplam_koli: sonuc.toplamKoli,
      toplam_hacim: sonuc.toplamHacim,
      toplam_agirlik: sonuc.toplamAgirlik,
      kullanilan_boy: sonuc.kullanilanBoy,
    });

    const r = await plandanSevkiyatOlustur({
      planId: kayit.success ? (kayit.id ?? null) : null,
      country_code: ulke,
      sevkiyat_adi: `${ulke} konteyner planı`,
      konteyner_tipi: tip,
      kalemler,
    });
    setDonusturuluyor(false);

    if (!r.success) {
      toast.error(r.error);
      return;
    }
    toast.success(`${r.sevkiyat_id} oluşturuldu`);
    router.push(`/sevkiyat/${r.sevkiyat_id}`);
  };

  const dizilim = useMemo(
    () => (sonuc ? dizilimTablosu(sonuc.bloklar) : []),
    [sonuc],
  );
  const renkMap = useMemo(() => {
    const m = new Map<string, string>();
    secili.forEach((u, i) => m.set(u.sku, RENKLER[i % RENKLER.length]));
    return m;
  }, [secili]);

  return (
    <div className="space-y-4">
      {/* Konteyner + çalıştır */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Konteyner</Label>
            <Select value={tip} onValueChange={setTip}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {konteynerTipleri.map((k) => (
                  <SelectItem key={k.type} value={k.type}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="pb-2 text-xs text-muted-foreground">
            <Container className="mr-1 inline size-3.5" />
            {kont.uzunluk} × {kont.genislik} × {kont.yukseklik} cm
            {kont.maxYukKg > 0 ? ` · azami ${kont.maxYukKg.toLocaleString("tr-TR")} kg` : ""}
          </p>

          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline">{secili.length} ürün seçili</Badge>
            <Button onClick={calistir} disabled={calisiyor}>
              {calisiyor ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <Play className="mr-1 size-4" />
              )}
              {sonuc ? "Tekrar Oluştur" : "İlerle"}
            </Button>
          </div>
        </div>

        {calisiyor && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${ilerleme}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Yerleştirme aranıyor — %{Math.round(ilerleme)}
            </p>
          </div>
        )}

        <Collapsible className="mt-3">
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Settings2 className="size-3.5" />
            Gelişmiş ayarlar
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-[11px]">Her üründen en az (koli)</Label>
              <Input value={enAzKoli} onChange={(e) => setEnAzKoli(e.target.value)} className="h-8" />
              <p className="text-[10px] text-muted-foreground">Seçilen her ürün bu kadar yer alır</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Arama süresi (sn)</Label>
              <Input value={butce} onChange={(e) => setButce(e.target.value)} className="h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">En küçük blok (koli)</Label>
              <Input value={minBlok} onChange={(e) => setMinBlok(e.target.value)} className="h-8" />
              <p className="text-[10px] text-muted-foreground">Düşürmek boşlukları doldurur ama dizilim dağılır</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Blok cezası</Label>
              <Input value={blokCezasi} onChange={(e) => setBlokCezasi(e.target.value)} className="h-8" />
              <p className="text-[10px] text-muted-foreground">Yükseltmek daha az, daha büyük blok verir</p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Sonuç özeti */}
      {sonuc && (
        <>
          {uyarilar.length > 0 && (
            <Card className="border-red-300 bg-red-50 p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-red-800">
                <TriangleAlert className="size-4" />
                Plan doğrulamadan geçemedi
              </p>
              <ul className="mt-1 list-disc pl-6 text-xs text-red-700">
                {uyarilar.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              ["Doluluk", `%${sonuc.dolulukYuzde}`],
              ["Koli", sonuc.toplamKoli.toLocaleString("tr-TR")],
              ["Hacim", `${sonuc.toplamHacim.toFixed(2)} m³`],
              ["Ağırlık", `${Math.round(sonuc.toplamAgirlik).toLocaleString("tr-TR")} kg`],
              ["Kullanılan boy", `${sonuc.kullanilanBoy} / ${kont.uzunluk} cm`],
            ].map(([b, d]) => (
              <Card key={b} className="p-3">
                <p className="text-xs text-muted-foreground">{b}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{d}</p>
              </Card>
            ))}
          </div>

          {sonuc.agirlikAsimi && (
            <Card className="border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <TriangleAlert className="mr-1 inline size-4" />
              Toplam ağırlık konteynerin azami yükünü aşıyor. Adetleri düşürmeniz gerekebilir.
            </Card>
          )}

          <KonteynerGorunum bloklar={sonuc.bloklar} kont={kont} renkler={renkMap} />

          {/* Planı sevkiyata çevir */}
          <Card className="flex flex-wrap items-end gap-3 p-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Ülke</Label>
              <Select value={ulke} onValueChange={setUlke}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DE">Almanya</SelectItem>
                  <SelectItem value="UK">İngiltere</SelectItem>
                  <SelectItem value="USA">Amerika</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="pb-2 flex-1 text-xs text-muted-foreground">
              Sevkiyat numarası ülkeye göre sıradan verilir. Kalemler koli bazında
              yazılır; palet dizilimi gerekiyorsa sevkiyat detayından düzenlersiniz.
            </p>
            <Button onClick={sevkiyataDonustur} disabled={donusturuluyor}>
              {donusturuluyor ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <Truck className="mr-1 size-4" />
              )}
              Sevkiyata Dönüştür
            </Button>
          </Card>
        </>
      )}

      {/* Ürün listesi */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="p-3">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Ürün ara"
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="max-h-[420px] space-y-1 overflow-y-auto">
            {gosterilen.map((u) => {
              const var_ = olculu(u);
              return (
                <div
                  key={u.sku}
                  className={cn(
                    "flex items-center gap-2 rounded px-2 py-1.5 text-sm",
                    secimler.has(u.sku) ? "bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  <Checkbox
                    checked={secimler.has(u.sku)}
                    disabled={!var_}
                    onCheckedChange={(c) => secimDegistir(u, c === true)}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-xs">{u.sku}</span>
                    <span className="ml-2 text-muted-foreground">{u.urun_adi}</span>
                  </div>
                  {var_ ? (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {u.boy}×{u.en}×{u.yuk}
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 shrink-0 text-[11px]"
                      onClick={() => setOlcuUrun(u)}
                    >
                      <Ruler className="mr-1 size-3" />
                      Ölçü ekle
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Seçilenler ve adetler */}
        <Card className="p-3">
          <p className="mb-2 text-sm font-medium">Seçilen ürünler ve adetler</p>
          {secili.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Soldan ürün seçin, sonra İlerle deyin.
            </p>
          ) : (
            <div className="space-y-1.5">
              {secili.map((u) => {
                const s = secimler.get(u.sku)!;
                const yuklenen = sonuc?.yuklenen[u.sku];
                const eksik = sonuc?.eksik[u.sku];
                return (
                  <div key={u.sku} className="flex items-center gap-2 rounded border px-2 py-1.5">
                    <span
                      className="size-3 shrink-0 rounded-sm"
                      style={{ background: renkMap.get(u.sku) }}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-xs">{u.sku}</span>
                      {yuklenen != null && (
                        <span className="ml-2 text-[11px] text-muted-foreground">
                          {yuklenen} koli
                          {u.koli_adedi ? ` · ${yuklenen * u.koli_adedi} adet` : ""}
                          {eksik ? ` · ${eksik} sığmadı` : ""}
                        </span>
                      )}
                    </div>
                    <Input
                      value={s.hedef}
                      onChange={(e) => alanGuncelle(u.sku, "hedef", e.target.value)}
                      placeholder="serbest"
                      className="h-7 w-20 text-center text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      title={s.kilitli ? "Adet sabit" : "Sistem belirlesin"}
                      onClick={() => alanGuncelle(u.sku, "kilitli", !s.kilitli)}
                    >
                      {s.kilitli ? (
                        <Lock className="size-3.5 text-amber-600" />
                      ) : (
                        <LockOpen className="size-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                );
              })}
              <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
                Kilit kapalıyken girilen sayı üst sınırdır, sistem daha az koyabilir.
                Kilitliyken tam o adet yüklenmeye çalışılır. Boş bırakırsanız sistem
                konteynere sığdığı kadarını koyar.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Dizilim tablosu */}
      {dizilim.length > 0 && (
        <Card className="overflow-x-auto">
          <div className="p-3 pb-0">
            <p className="text-sm font-medium">Dizilim Tablosu</p>
            <p className="text-[11px] text-muted-foreground">
              Sıra numarası yükleme sırasıdır: dipten kapıya, alttan üste. Üç orta
              sütun kolinin duruşunu verir — o koliyi koyduğunuzda hangi ölçüsünün
              hangi yöne bakacağı. Konum sütunları aynı bölgedeki blokları ayırır.
            </p>
          </div>
          <table className="mt-2 w-full text-xs">
            <thead>
              <tr className="border-y bg-muted/50 text-left">
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Ürün</th>
                <th className="px-2 py-2">Boy aralığı</th>
                <th className="px-2 py-2 text-center">Sol duvardan</th>
                <th className="px-2 py-2 text-center">Tabandan</th>
                <th className="px-2 py-2 text-center">Boya</th>
                <th className="px-2 py-2 text-center">Ene</th>
                <th className="px-2 py-2 text-center">Diğe</th>
                <th className="px-2 py-2 text-center">Sıra×Kolon×Kat</th>
                <th className="px-2 py-2 text-center">Koli</th>
              </tr>
            </thead>
            <tbody>
              {dizilim.map((d) => (
                <tr key={d.sira} className="border-b hover:bg-muted/30">
                  <td className="px-2 py-1.5 text-muted-foreground">{d.sira}</td>
                  <td className="px-2 py-1.5">
                    <span
                      className="mr-1.5 inline-block size-2.5 rounded-sm align-middle"
                      style={{ background: renkMap.get(d.sku) }}
                    />
                    <span className="font-mono">{d.sku}</span>
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                    {d.bas}–{d.bit}
                  </td>
                  <td className="px-2 py-1.5 text-center tabular-nums text-muted-foreground">{d.y}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums text-muted-foreground">{d.z}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{d.boya}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{d.ene}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums font-semibold">{d.dike}</td>
                  <td className="px-2 py-1.5 text-center font-mono">{d.sirakolonkat}</td>
                  <td className="px-2 py-1.5 text-center font-semibold tabular-nums">{d.koli}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <OlcuEkleDialog
        urun={olcuUrun}
        open={olcuUrun !== null}
        onOpenChange={(o) => !o && setOlcuUrun(null)}
        onKaydedildi={(sku, o) =>
          setUrunler((p) =>
            p.map((u) =>
              u.sku === sku
                ? { ...u, boy: o.boy, en: o.en, yuk: o.yuk, koli_adedi: o.koliAdedi, koli_agirlik: o.koliAgirlik }
                : u,
            ),
          )
        }
      />
    </div>
  );
}

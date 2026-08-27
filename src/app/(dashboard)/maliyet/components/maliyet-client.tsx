"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { maliyetAyarKaydet, malzemeFiyatKaydet } from "../actions";
import type { MaliyetVerisi } from "../constants";
import type { UrunMaliyet } from "@/lib/maliyet";
import {
  Calculator, Search, ChevronDown, ChevronRight, Info, TriangleAlert,
  Boxes, Wrench, Save, Pencil, Check,
} from "lucide-react";

const tl = (n: number) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";

export function MaliyetClient({ veri }: { veri: MaliyetVerisi }) {
  const [arama, setArama] = useState("");
  const [acik, setAcik] = useState<string | null>(null);
  const [sadeceEksik, setSadeceEksik] = useState(false);
  const [montaj, setMontaj] = useState(String(veri.ayar.montajSaatUcreti));
  const [paketleme, setPaketleme] = useState(String(veri.ayar.paketlemeSaatUcreti));
  const [bekliyor, basla] = useTransition();
  const router = useRouter();

  const ayEtiket = (a: string) => {
    const [y, m] = a.split("-");
    const adlar = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    return `${adlar[Number(m)]} ${y}`;
  };

  const filtre = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr");
    return veri.urunler.filter((u) => {
      if (sadeceEksik && !(u.eksikFiyatliParca.length > 0 || u.iscilikEksikAdim > 0)) return false;
      if (!q) return true;
      return u.sku.toLocaleLowerCase("tr").includes(q) ||
             (u.urunAdi ?? "").toLocaleLowerCase("tr").includes(q);
    });
  }, [veri.urunler, arama, sadeceEksik]);

  const toplamOrt = useMemo(() => {
    const gecerli = veri.urunler.filter((u) => u.birimMaliyet > 0);
    if (gecerli.length === 0) return { malzeme: 0, iscilik: 0, birim: 0 };
    return {
      malzeme: gecerli.reduce((t, u) => t + u.malzemeToplam, 0) / gecerli.length,
      iscilik: gecerli.reduce((t, u) => t + u.iscilikToplam, 0) / gecerli.length,
      birim: gecerli.reduce((t, u) => t + u.birimMaliyet, 0) / gecerli.length,
    };
  }, [veri.urunler]);

  const eksikSayi = veri.urunler.filter((u) => u.eksikFiyatliParca.length > 0 || u.iscilikEksikAdim > 0).length;

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calculator className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold">Ürün Birim Maliyet Analizi</h1>
            <p className="text-sm text-muted-foreground">
              Reçeteden malzeme + gerçek seans işçiliği (adet-ağırlıklı)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">İşçilik dönemi:</span>
          <select
            value={veri.secilenAy ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              router.push(v ? `/maliyet?ay=${v}` : "/maliyet");
            }}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">Tüm zamanlar</option>
            {veri.aylar.map((a) => (
              <option key={a} value={a}>{ayEtiket(a)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Yöntem notu */}
      <div className="flex gap-2 rounded border border-[#a99c7d]/40 bg-[#f0ede1] p-3 text-xs text-[#474237]">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          <b>Malzeme</b> = reçetedeki (step_bom) satın alınan parçalar × birim fiyat
          + kesilen parçaların MDF levha payı. <b>İşçilik</b> = her montaj/paketleme
          adımının <b>adet-ağırlıklı</b> gerçek işçilik süresi (Σ kişi-dk ÷ Σ adet)
          × saat ücreti. Dönem seçiliyse o ayın seansları; o ay veri yoksa tüm
          zamanlar verisine düşülür (satırda &quot;geçmiş&quot; rozeti).
        </span>
      </div>

      {/* İşçilik ücreti ayarı */}
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Montaj işçilik (₺/kişi-saat)</label>
          <Input type="number" value={montaj} onChange={(e) => setMontaj(e.target.value)} className="h-8 w-36" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Paketleme işçilik (₺/kişi-saat)</label>
          <Input type="number" value={paketleme} onChange={(e) => setPaketleme(e.target.value)} className="h-8 w-36" />
        </div>
        <Button
          size="sm" disabled={bekliyor}
          onClick={() => basla(async () => {
            const r = await maliyetAyarKaydet(Number(montaj), Number(paketleme));
            if (r.success) toast.success("Ücret güncellendi, sayfayı yenileyin");
            else toast.error(r.error ?? "Hata");
          })}
        >
          <Save className="mr-1.5 size-3.5" /> Kaydet
        </Button>
        <p className="text-xs text-muted-foreground">
          Değişiklik sonrası sayfayı yenileyince maliyetler bu ücretle yeniden hesaplanır.
        </p>
      </Card>

      {/* Ortalama KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { ikon: Boxes, et: "Ort. malzeme", v: tl(toplamOrt.malzeme), renk: "text-[#8d9d70]", tikla: false },
          { ikon: Wrench, et: "Ort. işçilik", v: tl(toplamOrt.iscilik), renk: "text-amber-600", tikla: false },
          { ikon: Calculator, et: "Ort. birim maliyet", v: tl(toplamOrt.birim), renk: "text-blue-600", tikla: false },
          { ikon: TriangleAlert, et: "Eksik verili ürün", v: String(eksikSayi), renk: "text-red-600", tikla: true },
        ].map((k) => (
          <Card
            key={k.et}
            onClick={k.tikla ? () => setSadeceEksik((x) => !x) : undefined}
            className={cn(
              "p-4",
              k.tikla && "cursor-pointer transition hover:border-red-300 hover:shadow-md",
              k.tikla && sadeceEksik && "border-red-400 ring-1 ring-red-300",
            )}
          >
            <div className="mb-1 flex items-center gap-2">
              <k.ikon className={cn("size-4", k.renk)} />
              <span className="text-xs text-muted-foreground">{k.et}</span>
            </div>
            <p className="text-xl font-bold tabular-nums">{k.v}</p>
            {k.tikla && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {sadeceEksik ? "Filtre açık — tümünü göster" : "Tıkla: yalnızca eksikleri gör"}
              </p>
            )}
          </Card>
        ))}
      </div>

      <Card className="p-0">
        <div className="border-b p-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={arama} onChange={(e) => setArama(e.target.value)}
              placeholder="Ürün ara..." className="h-9 pl-9" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Ürün</TableHead>
                <TableHead className="text-right">Malzeme</TableHead>
                <TableHead className="text-right">İşçilik</TableHead>
                <TableHead className="text-right">Birim Maliyet</TableHead>
                <TableHead>Uyarı</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtre.map((u) => (
                <MaliyetSatiri
                  key={u.sku} u={u}
                  acik={acik === u.sku}
                  toggle={() => setAcik(acik === u.sku ? null : u.sku)}
                />
              ))}
              {filtre.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">Ürün bulunamadı.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function MaliyetSatiri({ u, acik, toggle }: { u: UrunMaliyet; acik: boolean; toggle: () => void }) {
  const uyari = u.eksikFiyatliParca.length > 0 || u.iscilikEksikAdim > 0;
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/40" onClick={toggle}>
        <TableCell>{acik ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</TableCell>
        <TableCell>
          <span className="font-mono text-xs font-medium">{u.sku}</span>
          <span className="ml-2 text-xs text-muted-foreground">{u.urunAdi}</span>
        </TableCell>
        <TableCell className="text-right tabular-nums">{tl(u.malzemeToplam)}</TableCell>
        <TableCell className="text-right tabular-nums">{tl(u.iscilikToplam)}</TableCell>
        <TableCell className="text-right font-semibold tabular-nums">{tl(u.birimMaliyet)}</TableCell>
        <TableCell>
          {uyari ? (
            <Badge variant="outline" className="border-amber-300 text-amber-700">
              <TriangleAlert className="mr-1 size-3" />
              {u.eksikFiyatliParca.length > 0 ? `${u.eksikFiyatliParca.length} fiyatsız` : ""}
              {u.eksikFiyatliParca.length > 0 && u.iscilikEksikAdim > 0 ? " · " : ""}
              {u.iscilikEksikAdim > 0 ? `${u.iscilikEksikAdim} işçiliksiz adım` : ""}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-emerald-700">tam</Badge>
          )}
        </TableCell>
      </TableRow>
      {acik && (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell></TableCell>
          <TableCell colSpan={5}>
            <div className="grid gap-4 py-2 md:grid-cols-2">
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium">
                  <Boxes className="size-3.5" /> Malzeme ({tl(u.malzemeToplam)})
                </p>
                <div className="rounded border">
                  <table className="w-full text-xs">
                    <tbody>
                      {u.malzemeKalemleri.map((k) => (
                        <tr key={k.partId} className="border-b last:border-0">
                          <td className="px-2 py-1 align-top">
                            <span className="font-mono">{k.partId}</span>
                            <span className="ml-1 text-muted-foreground">{k.ad}</span>
                            {k.tur === "MDF" && <Badge variant="outline" className="ml-1 text-[9px]">MDF</Badge>}
                            {k.tur === "MDF" && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "ml-1 text-[9px]",
                                  k.kaynak === "manuel"
                                    ? "border-blue-300 text-blue-700"
                                    : "border-emerald-300 text-emerald-700",
                                )}
                              >
                                {k.kaynak === "manuel" ? "elle" : "formül"}
                              </Badge>
                            )}
                          </td>
                          <td className="px-2 py-1 text-right align-top">
                            <FiyatDuzenle partId={k.partId} mevcut={k.birimFiyat} />
                            <span className="ml-1 text-[10px] text-muted-foreground">× {k.miktar}</span>
                          </td>
                          <td className="px-2 py-1 text-right align-top font-medium tabular-nums">{tl(k.tutar)}</td>
                        </tr>
                      ))}
                      {u.eksikFiyatliParca.map((pid) => (
                        <tr key={pid} className="border-b bg-amber-50/40 last:border-0">
                          <td className="px-2 py-1 align-top">
                            <span className="font-mono">{pid}</span>
                            <Badge variant="outline" className="ml-1 border-amber-300 text-[9px] text-amber-700">
                              fiyatsız
                            </Badge>
                          </td>
                          <td className="px-2 py-1 text-right align-top" colSpan={2}>
                            <FiyatDuzenle partId={pid} mevcut={null} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {u.eksikFiyatliParca.length > 0 && (
                  <p className="mt-1 text-[11px] text-amber-700">
                    {u.eksikFiyatliParca.length} parçanın kesim/plaka verisi yok — birim fiyatı
                    elle girince maliyete eklenir.
                  </p>
                )}
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium">
                  <Wrench className="size-3.5" /> İşçilik ({tl(u.iscilikToplam)})
                </p>
                <div className="rounded border">
                  <table className="w-full text-xs">
                    <tbody>
                      {u.iscilikAdimlari.length === 0 ? (
                        <tr><td className="px-2 py-2 text-center text-muted-foreground">Seans verisi yok</td></tr>
                      ) : u.iscilikAdimlari.map((a, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-2 py-1">
                            {a.adim}
                            <Badge variant="outline" className="ml-1 text-[9px]">{a.kaynak}</Badge>
                            {a.eski && (
                              <Badge variant="outline" className="ml-1 border-amber-300 text-[9px] text-amber-700">geçmiş</Badge>
                            )}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">{a.dkAdet} dk/adet</td>
                          <td className="px-2 py-1 text-right tabular-nums font-medium">{tl(a.tutar)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {u.iscilikEksikAdim > 0 && (
                  <p className="mt-1 text-[11px] text-amber-700">
                    {u.iscilikEksikAdim} montaj adımının seans verisi yok — işçilik eksik hesaplanmış olabilir.
                  </p>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}


function FiyatDuzenle({ partId, mevcut }: { partId: string; mevcut: number | null }) {
  const [deger, setDeger] = useState(mevcut != null ? String(mevcut) : "");
  const [duzenle, setDuzenle] = useState(false);
  const [bekle, basla] = useTransition();

  if (!duzenle) {
    return (
      <button
        type="button"
        onClick={() => setDuzenle(true)}
        className="inline-flex items-center gap-1 tabular-nums text-muted-foreground hover:text-foreground"
      >
        {mevcut != null ? mevcut.toLocaleString("tr-TR") : <span className="text-amber-700">fiyat gir</span>}
        <Pencil className="size-3 opacity-60" />
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Input
        autoFocus
        value={deger}
        onChange={(e) => setDeger(e.target.value)}
        className="h-6 w-20 px-1 text-right text-xs"
        placeholder="₺"
      />
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-1.5"
        disabled={bekle}
        onClick={() =>
          basla(async () => {
            const r = await malzemeFiyatKaydet(partId, Number(deger));
            if (r.success) {
              toast.success(`${partId} fiyatı kaydedildi — sayfayı yenileyin`);
              setDuzenle(false);
            } else {
              toast.error(r.error ?? "Hata");
            }
          })
        }
      >
        <Check className="size-3.5" />
      </Button>
    </span>
  );
}

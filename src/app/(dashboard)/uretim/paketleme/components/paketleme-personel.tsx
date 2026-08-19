"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getPaketlemePersonelAnaliz, getPaketlemeKiyaslama,
  type PersonelAnalizi, type KiyasSonucu,
} from "../actions";
import { cn } from "@/lib/utils";
import { Users, Grid3x3, TriangleAlert, Info, GitCompare } from "lucide-react";

type Donem = "month" | "last_month" | "all";

const DONEM_ETIKET: Record<Donem, string> = {
  month: "Bu Ay",
  last_month: "Geçen Ay",
  all: "Tüm Zamanlar",
};

export function PaketlemePersonel() {
  const [donem, setDonem] = useState<Donem>("all");
  const [veri, setVeri] = useState<PersonelAnalizi | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const [t1, setT1] = useState<string>("");
  const [t2, setT2] = useState<string>("");
  const [kirilim, setKirilim] = useState<"sku" | "grup">("sku");
  const [kiyas, setKiyas] = useState<KiyasSonucu | null>(null);
  const [kiyasYukleniyor, setKiyasYukleniyor] = useState(false);

  // ── Ana veri
  useEffect(() => {
    let iptal = false;
    setYukleniyor(true);
    getPaketlemePersonelAnaliz(donem).then((r) => {
      if (iptal) return;
      if (r.success) {
        setVeri(r.data);
        setHata(null);
        // Varsayılan: en çok çalışan kişi ile farklı ekipten en çok çalışan kişi
        const s = r.data.satirlar;
        if (s.length >= 2) {
          const ilk = s[0];
          const ikinci = s.find((x) => x.ekip !== ilk.ekip) ?? s[1];
          setT1(ilk.id);
          setT2(ikinci.id);
        }
      } else {
        setVeri(null);
        setHata(r.error);
      }
      setYukleniyor(false);
    });
    return () => { iptal = true; };
  }, [donem]);

  // ── Kıyaslama
  useEffect(() => {
    if (!t1 || !t2 || t1 === t2) { setKiyas(null); return; }
    let iptal = false;
    setKiyasYukleniyor(true);
    getPaketlemeKiyaslama(donem, t1, t2, kirilim).then((r) => {
      if (iptal) return;
      setKiyas(r.success ? r.data : null);
      setKiyasYukleniyor(false);
    });
    return () => { iptal = true; };
  }, [donem, t1, t2, kirilim]);

  const tekKisilikGruplar = useMemo(() => {
    if (!veri) return [];
    return veri.gruplar.filter(
      (g) => Object.values(veri.matris).filter((r) => (r[g] ?? 0) > 0).length === 1,
    );
  }, [veri]);

  const hucreRengi = (satirMax: number, deger: number) => {
    if (deger <= 0) return "bg-muted/30 text-muted-foreground";
    const oran = satirMax > 0 ? deger / satirMax : 0;
    if (oran > 0.66) return "bg-[#8d9d70] text-white font-medium";
    if (oran > 0.33) return "bg-[#b1d286] text-[#3a4030]";
    return "bg-[#e3ecd2] text-[#3a4030]";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Personel ve Ekip Kıyaslaması</h2>
        <div className="flex gap-1.5">
          {(Object.keys(DONEM_ETIKET) as Donem[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDonem(d)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                donem === d
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              {DONEM_ETIKET[d]}
            </button>
          ))}
        </div>
      </div>

      {yukleniyor ? (
        <Skeleton className="h-[420px]" />
      ) : hata ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{hata}</Card>
      ) : !veri || veri.satirlar.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Bu dönemde tamamlanmış paketleme seansı yok.
        </Card>
      ) : (
        <>
          {/* ═══ KIYASLAMA ═══════════════════════════════════ */}
          <Card className="p-0">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <GitCompare className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Aynı üründe kim daha hızlı?</h3>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Select value={kirilim} onValueChange={(v) => setKirilim(v as "sku" | "grup")}>
                  <SelectTrigger className="h-8 w-[130px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sku">Ürün (SKU)</SelectItem>
                    <SelectItem value="grup">Ürün grubu</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={t1} onValueChange={setT1}>
                  <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="1. taraf" /></SelectTrigger>
                  <SelectContent>
                    {veri.satirlar.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.ad} ({s.seans})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">vs</span>
                <Select value={t2} onValueChange={setT2}>
                  <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="2. taraf" /></SelectTrigger>
                  <SelectContent>
                    {veri.satirlar.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.ad} ({s.seans})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 border-b bg-[#f0ede1] px-4 py-2.5 text-xs text-[#474237]">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Yalnızca <b>iki tarafın da paketlediği ürünler</b> karşılaştırılır — ürün
                farkı böylece devre dışı kalır. Ölçü <b>işçilik dk/adet</b> (geçen süre ×
                kişi ÷ adet); düşük olan hızlı. İkisinin birlikte olduğu seanslar ayırt
                etmediği için hesaba katılmaz.
              </span>
            </div>

            {kiyasYukleniyor ? (
              <div className="p-4"><Skeleton className="h-48" /></div>
            ) : !kiyas ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                Karşılaştırmak için iki farklı kişi seçin.
              </p>
            ) : kiyas.satirlar.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                Bu ikilinin ortak çalıştığı, yeterli ölçümü olan ürün yok. Dönemi
                genişletin ya da kırılımı &quot;Ürün grubu&quot;na alın.
              </p>
            ) : (
              <>
                {/* Özet */}
                <div className="grid gap-3 border-b p-4 sm:grid-cols-3">
                  <div className="rounded border p-3">
                    <p className="text-xs text-muted-foreground">Karşılaştırılan ürün</p>
                    <p className="text-xl font-semibold">{kiyas.satirlar.length}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {kiyas.kazanan1} · {kiyas.berabere} berabere · {kiyas.kazanan2}
                    </p>
                  </div>
                  <div className="rounded border p-3">
                    <p className="text-xs text-muted-foreground">Hacim ağırlıklı fark</p>
                    <p className={cn(
                      "text-xl font-semibold",
                      kiyas.agirlikliFark > 5 ? "text-emerald-700"
                        : kiyas.agirlikliFark < -5 ? "text-amber-700" : "",
                    )}>
                      {kiyas.agirlikliFark > 0 ? "+" : ""}{kiyas.agirlikliFark}%
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {kiyas.agirlikliFark > 0
                        ? `${kiyas.taraf1} daha hızlı`
                        : kiyas.agirlikliFark < 0
                          ? `${kiyas.taraf2} daha hızlı`
                          : "fark yok"}
                    </p>
                  </div>
                  <div className="rounded border p-3">
                    <p className="text-xs text-muted-foreground">Temizlenen kayıt</p>
                    <p className="text-xl font-semibold">{kiyas.molaDisi + kiyas.uzunDisi}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {kiyas.molaDisi} mola kapsayan · {kiyas.uzunDisi} 4 saat üstü
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px]">Ürün</TableHead>
                        <TableHead className="text-right">{kiyas.taraf1}</TableHead>
                        <TableHead className="text-right">{kiyas.taraf2}</TableHead>
                        <TableHead className="min-w-[180px]">Fark</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kiyas.satirlar.map((s) => {
                        const t1Hizli = s.farkYuzde > 5;
                        const t2Hizli = s.farkYuzde < -5;
                        const genislik = Math.min(100, Math.abs(s.farkYuzde));
                        return (
                          <TableRow key={s.urun}>
                            <TableCell className="font-medium">
                              {s.urun}
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                {s.adet.toLocaleString("tr-TR")} adet
                              </span>
                            </TableCell>
                            <TableCell className={cn("text-right tabular-nums", t1Hizli && "font-semibold text-emerald-700")}>
                              {s.med1}
                              <span className="ml-1 text-xs font-normal text-muted-foreground">n={s.n1}</span>
                            </TableCell>
                            <TableCell className={cn("text-right tabular-nums", t2Hizli && "font-semibold text-emerald-700")}>
                              {s.med2}
                              <span className="ml-1 text-xs font-normal text-muted-foreground">n={s.n2}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className={cn(
                                      "h-full rounded-full",
                                      t1Hizli ? "bg-[#70c1aa]" : t2Hizli ? "bg-[#f28a19]" : "bg-muted-foreground/30",
                                    )}
                                    style={{ width: `${genislik}%` }}
                                  />
                                </div>
                                <span className="text-xs tabular-nums text-muted-foreground">
                                  {s.farkYuzde > 0 ? "+" : ""}{s.farkYuzde}%
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </Card>

          {/* ═══ SABİT EKİPLER ═══════════════════════════════ */}
          <Card className="p-0">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Users className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Ekipler ve katılım</h3>
              <Badge variant="secondary" className="ml-auto text-[11px]">
                {veri.toplamSeans} seans
              </Badge>
            </div>

            <div className="flex gap-2 border-b bg-[#f0ede1] px-4 py-2.5 text-xs text-[#474237]">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Paketleme <b>sabit ekiplerle</b> yapılıyor. Aynı seanstaki kişilerin
                süresi, adedi ve ürünü aynı olduğu için <b>kişisel bir hız puanı
                üretilemiyor</b> — ölçülen şey kişi değil ekip olurdu. Bu tablo katılım
                ve hacim gösterir; hız karşılaştırması yukarıdaki bölümde.
                <b> Adet</b> ekip payıdır (3 kişilik seansta herkese 1/3).
              </span>
            </div>

            {veri.ekipler.length > 0 && (
              <div className="flex flex-wrap gap-2 border-b p-4">
                {veri.ekipler.slice(0, 6).map((e) => (
                  <div key={e.anahtar} className="rounded border px-3 py-2 text-xs">
                    <p className="font-medium">{e.ad}</p>
                    <p className="text-muted-foreground">
                      {e.seans} seans · {e.adet.toLocaleString("tr-TR")} adet
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Personel</TableHead>
                    <TableHead className="min-w-[150px]">En sık ekip</TableHead>
                    <TableHead className="text-right">Seans</TableHead>
                    <TableHead className="text-right">Adet (pay)</TableHead>
                    <TableHead className="text-right">Süre (sa)</TableHead>
                    <TableHead className="text-right">Ürün grubu</TableHead>
                    <TableHead className="text-right">Ort. ekip</TableHead>
                    <TableHead>Son çalışma</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {veri.satirlar.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.ad}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.ekip}
                        <span className="ml-1">%{s.ekipPayi}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s.seans}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.adet.toLocaleString("tr-TR")}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.sureSaat}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.grupSayisi}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.ortEkip}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.sonCalisma ? new Date(s.sonCalisma).toLocaleDateString("tr-TR") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* ═══ ÇOK YÖNLÜLÜK ════════════════════════════════ */}
          <Card className="p-0">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <Grid3x3 className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Çok yönlülük matrisi</h3>
              <span className="text-xs text-muted-foreground">
                Koyu renk kişinin yoğunlaştığı grup — boş hücreler eğitim açığı
              </span>
            </div>

            {tekKisilikGruplar.length > 0 && (
              <div className="mx-4 mt-3 flex gap-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  <b>Tek kişiye bağımlı grup:</b> {tekKisilikGruplar.join(", ")}. O kişi
                  izinliyken bu ürünü paketleyecek deneyimli kimse yok — çapraz eğitim adayı.
                </span>
              </div>
            )}

            <div className="overflow-x-auto p-4">
              <table className="w-full border-separate border-spacing-0.5 text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-background p-1 text-left font-medium">Personel</th>
                    {veri.gruplar.map((g) => (
                      <th key={g} className="max-w-[80px] p-1 text-center font-medium break-words">{g}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {veri.satirlar.map((s) => {
                    const satir = veri.matris[s.ad] ?? {};
                    const max = Math.max(1, ...veri.gruplar.map((g) => satir[g] ?? 0));
                    return (
                      <tr key={s.id}>
                        <td className="sticky left-0 whitespace-nowrap bg-background p-1 pr-3 font-medium">{s.ad}</td>
                        {veri.gruplar.map((g) => {
                          const v = satir[g] ?? 0;
                          return (
                            <td
                              key={g}
                              className={cn("rounded p-1 text-center tabular-nums", hucreRengi(max, v))}
                              title={`${s.ad} — ${g}: ${v.toLocaleString("tr-TR")} adet`}
                            >
                              {v > 0 ? v.toLocaleString("tr-TR") : "·"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

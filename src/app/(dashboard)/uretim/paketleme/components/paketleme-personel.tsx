"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getPaketlemePersonelAnaliz, type PersonelAnalizi } from "../actions";
import { cn } from "@/lib/utils";
import { Users, Grid3x3, TriangleAlert, Info } from "lucide-react";

type Donem = "month" | "last_month" | "all";

const DONEM_ETIKET: Record<Donem, string> = {
  month: "Bu Ay",
  last_month: "Geçen Ay",
  all: "Tüm Zamanlar",
};

/** Endeks rengi: 1.00 tesis standardı. Eşikler bilerek geniş — ±%10 gürültü. */
function endeksRengi(v: number) {
  if (v >= 1.1) return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (v <= 0.9) return "border-amber-300 bg-amber-50 text-amber-800";
  return "border-slate-300 bg-slate-50 text-slate-700";
}

export function PaketlemePersonel() {
  const [donem, setDonem] = useState<Donem>("month");
  const [veri, setVeri] = useState<PersonelAnalizi | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    let iptal = false;
    setYukleniyor(true);
    getPaketlemePersonelAnaliz(donem, "grup").then((r) => {
      if (iptal) return;
      if (r.success) { setVeri(r.data); setHata(null); }
      else { setVeri(null); setHata(r.error); }
      setYukleniyor(false);
    });
    return () => { iptal = true; };
  }, [donem]);

  const siralanan = useMemo(() => veri?.satirlar.filter((s) => s.yeterli) ?? [], [veri]);
  const yetersiz = useMemo(() => veri?.satirlar.filter((s) => !s.yeterli) ?? [], [veri]);

  /** Matriste yalnızca tek kişinin çalıştığı gruplar — çapraz eğitim riski */
  const tekKisilikGruplar = useMemo(() => {
    if (!veri) return [];
    return veri.gruplar.filter((g) => {
      const calisan = Object.values(veri.matris).filter((r) => (r[g] ?? 0) > 0).length;
      return calisan === 1;
    });
  }, [veri]);

  /** Isı haritası yoğunluğu, kişinin kendi en yüksek grubuna göre */
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
        <h2 className="text-base font-semibold">Personel Performansı</h2>
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
        <Skeleton className="h-[360px]" />
      ) : hata ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{hata}</Card>
      ) : !veri || veri.satirlar.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Bu dönemde tamamlanmış paketleme seansı yok.
        </Card>
      ) : (
        <>
          {/* ── Yöntem notu ─────────────────────────────────── */}
          <div className="flex gap-2 rounded border border-[#a99c7d]/40 bg-[#f0ede1] p-3 text-xs text-[#474237]">
            <Info className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-1">
              <p>
                <b>Endeks</b>, kişinin paketlediği <i>ürün karışımına göre</i> beklenen
                süreyle gerçek süresini karşılaştırır. <b>1.00 = tesis standardı</b>,
                1.15 = aynı sepetle %15 daha hızlı. Ham &quot;adet/saat&quot; yerine bu
                kullanılıyor; aksi halde kime kolay ürün düştüğünü ölçmüş olurduk.
              </p>
              <p className="opacity-80">
                <b>Adet</b> ekip payıdır (3 kişilik seansta herkese 1/3). Süre kişinin
                kendi saatidir. Standardı olan ürünler seansların{" "}
                <b>%{veri.standartKapsami}</b>&apos;ini kapsıyor. İstasyon tabletleri ortak
                hesapla kullanıldığından operatör seçimi hatalıysa satır da hatalı olur.
              </p>
            </div>
          </div>

          {/* ── Tablo ───────────────────────────────────────── */}
          <Card className="p-0">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Users className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Kişi bazlı özet</h3>
              <Badge variant="secondary" className="ml-auto text-[11px]">
                {veri.toplamSeans} seans
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[160px]">Personel</TableHead>
                    <TableHead className="text-right">Seans</TableHead>
                    <TableHead className="text-right">Adet (pay)</TableHead>
                    <TableHead className="text-right">Süre (sa)</TableHead>
                    <TableHead className="text-right">Ürün grubu</TableHead>
                    <TableHead className="text-right">Ort. ekip</TableHead>
                    <TableHead className="text-right">Kapsam</TableHead>
                    <TableHead className="text-right">Endeks</TableHead>
                    <TableHead>Son çalışma</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {siralanan.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.ad}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.seans}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.adet.toLocaleString("tr-TR")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s.sureSaat}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.grupSayisi}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.ortEkip}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        %{s.kapsam}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "inline-block rounded border px-2 py-0.5 text-xs font-semibold tabular-nums",
                            endeksRengi(s.endeks!),
                          )}
                        >
                          {s.endeks!.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.sonCalisma
                          ? new Date(s.sonCalisma).toLocaleDateString("tr-TR")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}

                  {yetersiz.length > 0 && (
                    <>
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={9}
                          className="bg-muted/40 py-2 text-xs text-muted-foreground"
                        >
                          Yetersiz veri — 10 seansın altında ya da işinin yarıdan
                          azı standardı olan üründe. Hacim rakamları geçerli,
                          <b> endeks hesaplanmıyor</b>.
                        </TableCell>
                      </TableRow>
                      {yetersiz.map((s) => (
                        <TableRow key={s.id} className="text-muted-foreground">
                          <TableCell>{s.ad}</TableCell>
                          <TableCell className="text-right tabular-nums">{s.seans}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.adet.toLocaleString("tr-TR")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{s.sureSaat}</TableCell>
                          <TableCell className="text-right tabular-nums">{s.grupSayisi}</TableCell>
                          <TableCell className="text-right tabular-nums">{s.ortEkip}</TableCell>
                          <TableCell className="text-right tabular-nums">%{s.kapsam}</TableCell>
                          <TableCell className="text-right">—</TableCell>
                          <TableCell className="text-xs">
                            {s.sonCalisma
                              ? new Date(s.sonCalisma).toLocaleDateString("tr-TR")
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* ── Çok yönlülük matrisi ────────────────────────── */}
          <Card className="p-0">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <Grid3x3 className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Çok yönlülük matrisi</h3>
              <span className="text-xs text-muted-foreground">
                Kimin hangi ürün grubunda deneyimi var — koyu renk o kişinin
                yoğunlaştığı grup
              </span>
            </div>

            {tekKisilikGruplar.length > 0 && (
              <div className="mx-4 mt-3 flex gap-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  <b>Tek kişiye bağımlı grup:</b> {tekKisilikGruplar.join(", ")}. Bu
                  kişi izinli olduğunda o ürünü paketleyecek deneyimli kimse yok —
                  çapraz eğitim adayı.
                </span>
              </div>
            )}

            <div className="overflow-x-auto p-4">
              <table className="w-full border-separate border-spacing-0.5 text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-background p-1 text-left font-medium">
                      Personel
                    </th>
                    {veri.gruplar.map((g) => (
                      <th
                        key={g}
                        className="max-w-[80px] p-1 text-center font-medium break-words"
                      >
                        {g}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {veri.satirlar.map((s) => {
                    const satir = veri.matris[s.ad] ?? {};
                    const max = Math.max(1, ...veri.gruplar.map((g) => satir[g] ?? 0));
                    return (
                      <tr key={s.id}>
                        <td className="sticky left-0 whitespace-nowrap bg-background p-1 pr-3 font-medium">
                          {s.ad}
                        </td>
                        {veri.gruplar.map((g) => {
                          const v = satir[g] ?? 0;
                          return (
                            <td
                              key={g}
                              className={cn(
                                "rounded p-1 text-center tabular-nums",
                                hucreRengi(max, v),
                              )}
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

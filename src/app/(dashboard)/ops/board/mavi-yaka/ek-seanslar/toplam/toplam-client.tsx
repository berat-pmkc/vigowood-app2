"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatRangeText } from "@/lib/periods";
import type { EkSeansToplam } from "@/lib/talimat/ek-seans";
import { saDk, tarihSaatTr } from "../ortak";

const BASE = "/ops/board/mavi-yaka/ek-seanslar/toplam";

const DONEMLER = [
  { key: "bugun", label: "Bugün" },
  { key: "bu-hafta", label: "Bu Hafta" },
  { key: "gecen-hafta", label: "Geçen Hafta" },
  { key: "bu-ay", label: "Bu Ay" },
  { key: "gecen-ay", label: "Geçen Ay" },
];

type SiraAlani =
  | "personel_adi" | "seans_sayisi" | "toplam_adet" | "toplam_sure_dk" | "montaj_sayisi" | "paketleme_sayisi" | "son_seans";

const KOLONLAR: { alan: SiraAlani; etiket: string; sag?: boolean }[] = [
  { alan: "personel_adi", etiket: "Personel" },
  { alan: "seans_sayisi", etiket: "Ek seans", sag: true },
  { alan: "toplam_adet", etiket: "Toplam adet", sag: true },
  { alan: "toplam_sure_dk", etiket: "Toplam süre (sa:dk)", sag: true },
  { alan: "montaj_sayisi", etiket: "Montaj", sag: true },
  { alan: "paketleme_sayisi", etiket: "Paketleme", sag: true },
  { alan: "son_seans", etiket: "En son ek seans" },
];

interface Props {
  toplamlar: EkSeansToplam[];
  hata: string | null;
  periodKey: string;
  from: string;
  to: string;
  etiket: string;
}

export function ToplamClient({ toplamlar, hata, periodKey, from, to, etiket }: Props) {
  const router = useRouter();
  const [sira, setSira] = useState<{ alan: SiraAlani; yon: 1 | -1 }>({ alan: "seans_sayisi", yon: -1 });
  const [ozelFrom, setOzelFrom] = useState(from);
  const [ozelTo, setOzelTo] = useState(to);

  const satirlar = useMemo(() => {
    const a = [...toplamlar];
    a.sort((x, y) => {
      const vx = x[sira.alan] ?? "";
      const vy = y[sira.alan] ?? "";
      const c = typeof vx === "number" && typeof vy === "number" ? vx - vy : String(vx).localeCompare(String(vy), "tr");
      return c * sira.yon;
    });
    return a;
  }, [toplamlar, sira]);

  const genel = useMemo(
    () =>
      toplamlar.reduce(
        (g, t) => ({
          seans: g.seans + t.seans_sayisi,
          adet: g.adet + t.toplam_adet,
          sure: g.sure + t.toplam_sure_dk,
          montaj: g.montaj + t.montaj_sayisi,
          paket: g.paket + t.paketleme_sayisi,
        }),
        { seans: 0, adet: 0, sure: 0, montaj: 0, paket: 0 },
      ),
    [toplamlar],
  );

  const sirala = (alan: SiraAlani) =>
    setSira((s) => (s.alan === alan ? { alan, yon: (s.yon * -1) as 1 | -1 } : { alan, yon: alan === "personel_adi" ? 1 : -1 }));

  const detayHref = (pid: string) =>
    `/ops/board/mavi-yaka/ek-seanslar?from=${from}&to=${to}&personel=${encodeURIComponent(pid)}`;
  const ozelUygula = () => router.push(`${BASE}?period=ozel&from=${ozelFrom}&to=${ozelTo}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href="/ops/board/mavi-yaka">
            <ArrowLeft className="mr-1 h-4 w-4" /> Geri
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-vw-dark">Toplam Açılan Ek Seanslar</h1>
          <p className="text-sm text-muted-foreground">
            Personel bazlı toplamlar — {etiket}: {formatRangeText(from, to)}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="ml-auto">
          <Link href="/ops/board/mavi-yaka/ek-seanslar">
            <ListChecks className="mr-1.5 h-4 w-4" /> Açılan Ek Seanslar
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {DONEMLER.map((d) => (
          <Button
            key={d.key}
            size="sm"
            variant={periodKey === d.key ? "default" : "outline"}
            className={cn(periodKey === d.key && "bg-vw-deep text-white")}
            onClick={() => router.push(`${BASE}?period=${d.key}`)}
          >
            {d.label}
          </Button>
        ))}
        <span className={cn("ml-2 text-sm", periodKey === "ozel" ? "font-bold text-vw-deep" : "text-muted-foreground")}>
          Özel aralık:
        </span>
        <Input type="date" value={ozelFrom} onChange={(e) => setOzelFrom(e.target.value)} className="h-9 w-40" aria-label="Başlangıç" />
        <span className="text-muted-foreground">–</span>
        <Input type="date" value={ozelTo} onChange={(e) => setOzelTo(e.target.value)} className="h-9 w-40" aria-label="Bitiş" />
        <Button size="sm" variant="outline" disabled={!ozelFrom || !ozelTo} onClick={ozelUygula}>
          Uygula
        </Button>
      </div>

      {hata && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{hata}</p>}

      {!hata && satirlar.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">Bu dönemde ek seans yok.</p>
      ) : (
        <div className="max-h-[calc(100dvh-16rem)] overflow-auto rounded-lg border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 z-10 bg-vw-dark text-white">
              <tr>
                {KOLONLAR.map((k) => (
                  <th key={k.alan} className={cn("px-3 py-2.5 font-semibold", k.sag ? "text-right" : "text-left")}>
                    <button type="button" onClick={() => sirala(k.alan)} className="inline-flex items-center gap-1">
                      {k.etiket}
                      {sira.alan === k.alan &&
                        (sira.yon === 1 ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {satirlar.map((t) => (
                <tr key={t.personel_id} className="border-b hover:bg-muted/40">
                  <td className="px-3 py-2.5 font-medium">
                    <Link href={detayHref(t.personel_id)} className="text-vw-deep underline-offset-2 hover:underline">
                      {t.personel_adi}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums">{t.seans_sayisi}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{t.toplam_adet}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{saDk(t.toplam_sure_dk)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{t.montaj_sayisi}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{t.paketleme_sayisi}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{tarihSaatTr(t.son_seans)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-muted font-bold">
              <tr>
                <td className="px-3 py-2.5">Genel toplam ({satirlar.length} personel)</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{genel.seans}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{genel.adet}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{saDk(genel.sure)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{genel.montaj}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{genel.paket}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

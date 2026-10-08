"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Search, Sigma, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addDays, formatRangeText, formatTrDate } from "@/lib/periods";
import type { EkSeansSatirHat as EkSeansSatir } from "@/lib/talimat/planlayici-hat";
import { DURUM_ETIKET, DURUM_STIL, saDk, saatTr } from "./ortak";

function normalize(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .trim();
}

interface Props {
  satirlar: EkSeansSatir[];
  hata: string | null;
  gun: string;
  bugun: string;
  aralik: { from: string; to: string } | null;
  personelFiltre: string | null;
}

export function EkSeanslarClient({ satirlar, hata, gun, bugun, aralik, personelFiltre }: Props) {
  const router = useRouter();
  const [arama, setArama] = useState("");
  const [istasyon, setIstasyon] = useState<"tumu" | "montaj" | "paketleme">("tumu");

  const gruplar = useMemo(() => {
    const q = normalize(arama);
    const m = new Map<string, { id: string; ad: string; satirlar: EkSeansSatir[] }>();
    for (const s of satirlar) {
      if (istasyon !== "tumu" && s.kaynak !== istasyon) continue;
      const hatAd = s.hat_adi ?? "Hatsız";
      if (q && !normalize(hatAd).includes(q) && !normalize(s.personel_adi ?? "").includes(q) && !normalize(s.personel_id ?? "").includes(q)) continue;
      const id = s.hat_id ?? s.hat_adi ?? "-";
      let g = m.get(id);
      if (!g) {
        g = { id, ad: hatAd, satirlar: [] };
        m.set(id, g);
      }
      g.satirlar.push(s);
    }
    return [...m.values()].sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  }, [satirlar, arama, istasyon]);

  const toplam = gruplar.reduce((n, g) => n + g.satirlar.length, 0);
  const gunGit = (g: string) =>
    router.push(`/ops/board/mavi-yaka/ek-seanslar?gun=${g}${personelFiltre ? `&personel=${personelFiltre}` : ""}`);
  const baslikTarih = aralik ? formatRangeText(aralik.from, aralik.to) : formatTrDate(gun);
  const kolonSayisi = aralik ? 9 : 8;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href="/ops/board/mavi-yaka">
            <ArrowLeft className="mr-1 h-4 w-4" /> Geri
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-vw-dark">Açılan Ek Seanslar</h1>
          <p className="text-sm text-muted-foreground">Hatlarda “Ek Seans Aç” ile başlatılan plan dışı seanslar (hat bazlı)</p>
        </div>
        <Button asChild variant="outline" size="sm" className="ml-auto">
          <Link href="/ops/board/mavi-yaka/ek-seanslar/toplam">
            <Sigma className="mr-1.5 h-4 w-4" /> Toplam Ek Seanslar
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {aralik ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/ops/board/mavi-yaka/ek-seanslar">Günlük görünüme dön</Link>
          </Button>
        ) : (
          <>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => gunGit(addDays(gun, -1))} aria-label="Önceki gün">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={gun}
              max={bugun}
              onChange={(e) => e.target.value && gunGit(e.target.value)}
              className="h-9 w-40"
            />
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={gun >= bugun}
              onClick={() => gunGit(addDays(gun, 1))}
              aria-label="Sonraki gün"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant={gun === bugun ? "default" : "outline"}
              size="sm"
              className={cn(gun === bugun && "bg-vw-deep text-white")}
              onClick={() => gunGit(bugun)}
            >
              Bugün
            </Button>
          </>
        )}
        <span className="text-sm font-semibold text-vw-dark">{baslikTarih}</span>

        <div className="relative ml-auto w-full sm:w-56">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Hat veya personel ara" className="h-9 pl-8" />
        </div>
        <div className="flex gap-1">
          {(["tumu", "montaj", "paketleme"] as const).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={istasyon === k ? "default" : "outline"}
              className={cn("h-9", istasyon === k && "bg-vw-deep text-white")}
              onClick={() => setIstasyon(k)}
            >
              {k === "tumu" ? "Tümü" : k === "montaj" ? "Montaj" : "Paketleme"}
            </Button>
          ))}
        </div>
      </div>

      {personelFiltre && (
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-full bg-vw-primary/20 px-3 py-1 font-medium">
            Personel: {personelFiltre}
          </span>
          <Button asChild variant="ghost" size="sm" className="h-7">
            <Link
              href={
                aralik
                  ? `/ops/board/mavi-yaka/ek-seanslar?from=${aralik.from}&to=${aralik.to}`
                  : "/ops/board/mavi-yaka/ek-seanslar"
              }
            >
              <X className="mr-1 h-3.5 w-3.5" /> Filtreyi kaldır
            </Link>
          </Button>
        </div>
      )}

      {hata && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{hata}</p>}

      {!hata && toplam === 0 ? (
        <p className="py-16 text-center text-muted-foreground">Bu tarihte ek seans yok.</p>
      ) : (
        <div className="max-h-[calc(100dvh-16rem)] space-y-5 overflow-auto rounded-lg border bg-card p-3">
          {gruplar.map((g) => (
            <section key={g.id}>
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="sticky top-0 z-20 bg-vw-dark text-white">
                    <th colSpan={kolonSayisi} className="rounded-t-md px-3 py-2 text-left text-base font-bold">
                      {g.ad}
                      <span className="ml-2 rounded-full bg-white/25 px-2 py-0.5 text-xs font-semibold">
                        {g.satirlar.length} ek seans
                      </span>
                    </th>
                  </tr>
                  <tr className="sticky top-[2.4rem] z-10 bg-muted text-left text-xs uppercase text-muted-foreground">
                    {aralik && <th className="px-3 py-1.5">Gün</th>}
                    <th className="px-3 py-1.5">Saat</th>
                    <th className="px-3 py-1.5">Personel</th>
                    <th className="px-3 py-1.5">İstasyon</th>
                    <th className="px-3 py-1.5">Ürün</th>
                    <th className="px-3 py-1.5">Adım</th>
                    <th className="px-3 py-1.5 text-right">Adet</th>
                    <th className="px-3 py-1.5 text-right">Süre (dk)</th>
                    <th className="px-3 py-1.5">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {g.satirlar.map((s) => (
                    <tr key={s.session_id} className="border-b last:border-0">
                      {aralik && <td className="px-3 py-2 tabular-nums">{formatTrDate(s.gun)}</td>}
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                        {saatTr(s.start_time)}–{s.end_time ? saatTr(s.end_time) : "…"}
                      </td>
                      <td className="px-3 py-2">{s.personel_adi ?? s.personel_id ?? "—"}</td>
                      <td className="px-3 py-2">{s.kaynak === "montaj" ? "Montaj" : "Paketleme"}</td>
                      <td className="px-3 py-2">
                        <span className="font-semibold">{s.sku ?? "—"}</span>
                        <span className="block max-w-[22rem] truncate text-xs text-muted-foreground">{s.urun_adi ?? ""}</span>
                      </td>
                      <td className="px-3 py-2">{s.kaynak === "montaj" ? `${s.seq_no ?? ""}. ${s.step_name ?? ""}` : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.durum === "tamamlandi" ? s.qty : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.net_sure_dk === null ? (
                          "—"
                        ) : (
                          <>
                            {Math.round(s.net_sure_dk)}
                            <span className="ml-1 text-xs text-muted-foreground">({saDk(s.net_sure_dk)})</span>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", DURUM_STIL[s.durum])}>
                          {DURUM_ETIKET[s.durum]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

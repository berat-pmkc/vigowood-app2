"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TALIMAT_ISTASYON_LABEL } from "@/lib/talimat/constants";
import { personeleGoreGrupla } from "@/lib/talimat/helpers";
import type { SatirKaydetGirdi } from "@/lib/talimat/types";
import type { TalimatSatir } from "@/lib/talimat/types";

function zamanTr(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Haftanın tamamlanan satırları */
  satirlar: TalimatSatir[];
  /** Plan düzenlenebilir mi (tekrar aktif et yalnızca o zaman) */
  editable: boolean;
  kaydet: (satirId: string, alanlar: Partial<SatirKaydetGirdi>) => Promise<void>;
}

/** Tamamlanan iş talimatı satırları (salt okunur) + "Tekrar aktif et" */
export function TamamlananlarDialog({ open, onOpenChange, satirlar, editable, kaydet }: Props) {
  const gruplar = useMemo(
    () =>
      [...personeleGoreGrupla(satirlar).entries()]
        .map(([pid, liste]) => ({ pid, ad: liste[0]?.personel_adi ?? pid, liste }))
        .sort((a, b) => a.ad.localeCompare(b.ad, "tr")),
    [satirlar],
  );
  const [acik, setAcik] = useState<TalimatSatir | null>(null);
  const [deger, setDeger] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ac = (s: TalimatSatir) => {
    setAcik(s);
    setDeger(String(s.istenen_miktar ?? ""));
    setHata(null);
  };

  const onayla = async () => {
    if (!acik) return;
    const n = deger.trim() === "" ? null : Number(deger.replace(",", "."));
    if (n !== null && (!Number.isFinite(n) || n <= 0)) return setHata("Geçerli bir miktar girin");
    if (n !== null && n <= acik.uretilen) return setHata(`Yeni istenen, üretilenden (${acik.uretilen}) büyük olmalı`);
    if (n === null && acik.durum !== "tamamlandi") return setHata("Yeni istenen miktarı girin");
    setBusy(true);
    await kaydet(acik.satir_id, { istenen_miktar: n, ...(acik.durum === "tamamlandi" ? { durum: "aktif" as const } : {}) });
    setBusy(false);
    setAcik(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Tamamlananlar ({satirlar.length})</DialogTitle>
          <DialogDescription>
            İstenen miktarına ulaşan satırlar ana listeden ve tablet listesinden otomatik çıkar. Tamamlanma zamanı yerine son üretim zamanı gösterilir.
          </DialogDescription>
        </DialogHeader>

        {gruplar.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Bu hafta tamamlanan satır yok.</p>
        ) : (
          <div className="space-y-4">
            {gruplar.map((g) => (
              <div key={g.pid} className="overflow-x-auto rounded-md border">
                <div className="bg-[#e6dfc9] px-3 py-1.5 text-sm font-bold text-vw-dark">{g.ad}</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-3 py-1.5">Sıra</th>
                      <th className="px-3 py-1.5">İstasyon</th>
                      <th className="px-3 py-1.5">Ürün</th>
                      <th className="px-3 py-1.5 text-right">İstenen</th>
                      <th className="px-3 py-1.5 text-right">Üretilen</th>
                      <th className="px-3 py-1.5">Son üretim</th>
                      <th className="px-3 py-1.5">Talep</th>
                      {editable && <th className="px-3 py-1.5" />}
                    </tr>
                  </thead>
                  <tbody>
                    {g.liste.map((s) => (
                      <tr key={s.satir_id} className="border-b last:border-0">
                        <td className="px-3 py-1.5 tabular-nums">{s.sira}</td>
                        <td className="px-3 py-1.5">{TALIMAT_ISTASYON_LABEL[s.etkin_istasyon]}</td>
                        <td className="px-3 py-1.5">
                          <span className="font-medium">{s.sku ?? s.plaka_id ?? "—"}</span>
                          <span className="ml-2 text-muted-foreground">{s.urun_adi ?? ""}</span>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{s.istenen_miktar ?? "—"}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{s.uretilen}</td>
                        <td className="whitespace-nowrap px-3 py-1.5">{zamanTr(s.son_seans_at)}</td>
                        <td className="px-3 py-1.5">
                          {s.talep_id ? (
                            <Link href={`/talepler?talep=${s.talep_id}`} className="text-[#3368b1] underline">Talep</Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        {editable && (
                          <td className="px-3 py-1.5 text-right">
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => ac(s)}>
                              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Tekrar aktif et
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        <Dialog open={acik !== null} onOpenChange={(o) => !o && setAcik(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Talimatı tekrar aktif et</DialogTitle>
              <DialogDescription>
                {acik?.sku ?? acik?.plaka_id} · üretilen {acik?.uretilen}. Satırı yeniden açmak için yeni istenen miktarı girin.
              </DialogDescription>
            </DialogHeader>
            <Input
              inputMode="decimal"
              value={deger}
              onChange={(e) => setDeger(e.target.value)}
              placeholder="Yeni istenen miktar"
              autoFocus
            />
            {hata && <p className="text-sm text-[#c0424f]">{hata}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAcik(null)}>Vazgeç</Button>
              <Button className="bg-vw-deep text-white hover:bg-vw-dark" disabled={busy} onClick={onayla}>Aktif et</Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

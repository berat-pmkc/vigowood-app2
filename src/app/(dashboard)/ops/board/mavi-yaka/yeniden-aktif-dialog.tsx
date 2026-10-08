"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { TalimatSatir } from "@/lib/talimat/types";

interface Props {
  /** Aktif edilecek tamamlanmış satırlar (boş = kapalı) */
  hedefler: TalimatSatir[];
  /** Tek satır için: hattın aktif satır sayısı (iş sırası seçimi 1..n+1) */
  aktifSayisi: number;
  onClose: () => void;
  /** Hata mesajı döner (null = başarılı). sira: görünen konum, null = aktiflerin sonu */
  onayla: (items: { satirId: string; istenen: number }[], sira: number | null) => Promise<string | null>;
}

/** Tamamlanan satır(lar)ı tekrar aktif et: istenen miktar + iş sırası (aktiflerin sonu / N. sıra) */
export function YenidenAktifDialog({ hedefler, aktifSayisi, onClose, onayla }: Props) {
  const tek = hedefler.length === 1 ? hedefler[0] : null;
  const [deger, setDeger] = useState("");
  const [sira, setSira] = useState<"son" | "sec">("son");
  const [siraNo, setSiraNo] = useState(1);
  const [hata, setHata] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hedefler.length === 0) return;
    setDeger(String(hedefler[0].istenen_miktar ?? ""));
    setSira("son");
    setSiraNo(1);
    setHata(null);
  }, [hedefler]);

  const gonder = async () => {
    let items: { satirId: string; istenen: number }[];
    if (tek) {
      const n = Number(deger.trim().replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) return setHata("Geçerli bir miktar girin");
      items = [{ satirId: tek.satir_id, istenen: n }];
    } else {
      // Toplu: her satır önceki istenen miktarıyla
      const gecersiz = hedefler.find((s) => !s.istenen_miktar || s.istenen_miktar <= 0);
      if (gecersiz) return setHata(`${gecersiz.sku ?? "Satır"} için önceki istenen miktar yok; tek tek aktif edin`);
      items = hedefler.map((s) => ({ satirId: s.satir_id, istenen: Number(s.istenen_miktar) }));
    }
    setBusy(true);
    const h = await onayla(items, tek && sira === "sec" ? Math.min(Math.max(1, Math.floor(siraNo) || 1), aktifSayisi + 1) : null);
    setBusy(false);
    if (h) setHata(h);
    else onClose();
  };

  return (
    <Dialog open={hedefler.length > 0} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tek ? "Talimatı tekrar aktif et" : `${hedefler.length} talimatı tekrar aktif et`}</DialogTitle>
          <DialogDescription>
            {tek
              ? `${tek.sku ?? tek.plaka_id} · üretilen ${tek.uretilen}. Sayaç sıfırlanır; yeni üretim bu andan itibaren sayılır.`
              : "Sayaçlar sıfırlanır; her satır önceki istenen miktarıyla ve hattın aktif satırlarının sonuna eklenir."}
          </DialogDescription>
        </DialogHeader>

        {tek ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Yeni istenen miktar</Label>
              <Input inputMode="decimal" value={deger} onChange={(e) => setDeger(e.target.value)} placeholder="Yeni istenen miktar" autoFocus />
            </div>
            <div className="space-y-1">
              <Label>İş sırası</Label>
              <div className="grid grid-cols-2 gap-1 rounded-md border border-vw-side/50 bg-vw-light p-1">
                {(
                  [
                    ["son", "Aktiflerin sonu"],
                    ["sec", "Belirli sıra"],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSira(k)}
                    className={cn("min-h-9 rounded px-1 text-sm font-medium", sira === k ? "bg-vw-deep text-white" : "text-vw-dark hover:bg-black/5")}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {sira === "sec" && (
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    type="number"
                    min={1}
                    max={aktifSayisi + 1}
                    value={siraNo}
                    onChange={(e) => setSiraNo(Number(e.target.value))}
                    className="h-9 w-24"
                  />
                  <span className="text-xs text-muted-foreground">/ {aktifSayisi + 1} (aktif satırlar arasındaki sıra)</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <ul className="max-h-40 space-y-0.5 overflow-auto rounded border bg-muted/30 p-2 text-sm">
            {hedefler.map((s) => (
              <li key={s.satir_id} className="flex justify-between gap-2">
                <span className="truncate">{s.sku ?? s.plaka_id} · {s.urun_adi ?? ""}</span>
                <span className="tabular-nums text-muted-foreground">{s.istenen_miktar}</span>
              </li>
            ))}
          </ul>
        )}

        {hata && <p className="rounded bg-[#fde8ea] px-2 py-1.5 text-sm text-[#c0424f]">{hata}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Vazgeç</Button>
          <Button className="bg-vw-deep text-white hover:bg-vw-dark" disabled={busy} onClick={gonder}>
            <RotateCcw className="mr-1.5 h-4 w-4" /> Aktif et
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

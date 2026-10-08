"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { talimatZamanliIslemIptal } from "@/lib/talimat/zamanli-actions";
import type { TalimatHat, TalimatSatir, ZamanliIslem } from "@/lib/talimat/types";
import { zamanEtiketi } from "./zamanli-secenek";

const YAYIN_ETIKET: Record<string, string> = { yok: "", bildirimsiz: " · bildirimsiz yayın", bildirimli: " · bildirimli yayın" };

/** Bir işlemin kısa özeti: "Aktif et · 12.10.2026 14:30 · 2. sıra" */
export function zamanliOzet(i: ZamanliIslem): string {
  return `${i.islem === "pasif" ? "Pasif" : "Aktif"} · ${zamanEtiketi(i.calisma_zamani)}${
    i.hedef_sira ? ` · ${i.hedef_sira}. sıra` : ""
  }${YAYIN_ETIKET[i.yayin] ?? ""}`;
}

/** Plandaki bekleyen zamanlı işlemler: liste + iptal */
export function ZamanliListeDialog({
  open,
  onOpenChange,
  islemler,
  hatlar,
  satirlar,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  islemler: ZamanliIslem[];
  hatlar: TalimatHat[];
  satirlar: TalimatSatir[];
  onDone: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const hedefMetni = (i: ZamanliIslem): string => {
    if (i.kapsam === "liste") return "Tüm liste";
    if (i.kapsam === "hat") {
      const adlar = i.ids.map((id) => hatlar.find((h) => h.hat_id === id)?.ad ?? "Hat");
      return adlar.join(", ");
    }
    const s = i.ids.map((id) => satirlar.find((x) => x.satir_id === id)).filter((x): x is TalimatSatir => !!x);
    if (s.length === 0) return `${i.ids.length} satır`;
    const ilk = s[0];
    return `${ilk.hat_adi ?? "Hat"} · ${s.length === 1 ? `${ilk.sku ?? "boş satır"}` : `${s.length} satır`}`;
  };

  const iptal = async (id: string) => {
    setBusy(id);
    const r = await talimatZamanliIslemIptal(id);
    setBusy(null);
    if (!r.success) toast.error(r.error);
    else toast.success(r.data ? "Zamanlanmış işlem iptal edildi" : "İşlem zaten çalışmış veya iptal edilmiş");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Zamanlanmış işlemler</DialogTitle>
          <DialogDescription>Zamanı gelince otomatik uygulanacak pasif / aktif işlemleri.</DialogDescription>
        </DialogHeader>
        {islemler.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Bekleyen zamanlanmış işlem yok.</p>
        ) : (
          <ul className="space-y-2">
            {islemler.map((i) => (
              <li key={i.islem_id} className="flex items-start gap-2 rounded-md border border-vw-side/40 bg-vw-light/60 p-2.5 text-sm">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-vw-deep" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-vw-dark">{zamanliOzet(i)}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {hedefMetni(i)}
                    {i.pasif_neden ? ` · ${i.pasif_neden}` : ""}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                  disabled={busy === i.islem_id}
                  onClick={() => void iptal(i.islem_id)}
                >
                  <X className="mr-1 h-3.5 w-3.5" /> İptal
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

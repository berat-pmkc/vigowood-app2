"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hatEkle, hatGuncelle } from "@/lib/talimat/hat-actions";
import type { HatTur, TalimatHat } from "@/lib/talimat/types";
import { cn } from "@/lib/utils";

export const HAT_TUR_LABEL: Record<HatTur, string> = { montaj: "Montaj", paketleme: "Paketleme" };

function TurSecici({ value, onChange }: { value: HatTur; onChange: (t: HatTur) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-md border border-vw-side/50 bg-vw-light p-1">
      {(["montaj", "paketleme"] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={cn(
            "h-9 rounded text-sm font-medium transition-colors",
            value === t ? "bg-vw-deep text-white" : "text-vw-dark hover:bg-black/5",
          )}
        >
          {HAT_TUR_LABEL[t]}
        </button>
      ))}
    </div>
  );
}

/** Başlıktaki ana buton: yeni hat adı + türü sorar, hat_ekle çağırır */
export function HatEkle({ onDone }: { onDone: () => void }) {
  const [acik, setAcik] = useState(false);
  const [ad, setAd] = useState("");
  const [tur, setTur] = useState<HatTur>("montaj");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (acik) {
      setAd("");
      setTur("montaj");
    }
  }, [acik]);

  const kaydet = async () => {
    if (!ad.trim()) return void toast.error("Hat adı boş olamaz");
    setBusy(true);
    const r = await hatEkle(ad.trim().toLocaleUpperCase("tr"), tur);
    setBusy(false);
    if (!r.success) return void toast.error(r.error);
    toast.success(`${ad.trim().toLocaleUpperCase("tr")} eklendi`);
    setAcik(false);
    onDone();
  };

  return (
    <>
      <Button
        size="lg"
        onClick={() => setAcik(true)}
        className="h-12 gap-2 bg-vw-deep px-6 text-base font-semibold text-white shadow-sm hover:bg-vw-dark"
      >
        <Plus className="h-5 w-5" /> Hat Ekle
      </Button>
      <Dialog open={acik} onOpenChange={setAcik}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Hat ekle</DialogTitle>
            <DialogDescription>Yeni hat tüm haftalık planlarda 1 boş satırla açılır.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Hat adı</Label>
              <Input
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                placeholder="Örn. MONTAJ 4 HATTI"
                maxLength={60}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && void kaydet()}
              />
            </div>
            <div>
              <Label className="mb-1 block">Tür</Label>
              <TurSecici value={tur} onChange={setTur} />
              <p className="mt-1 text-xs text-muted-foreground">
                Montaj: son montaj aşaması adedi sayılır. Paketleme: paketleme adedi sayılır.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcik(false)}>
              Vazgeç
            </Button>
            <Button onClick={kaydet} disabled={busy} className="bg-vw-deep text-white hover:bg-vw-dark">
              Hat ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Hat adı / türü düzenleme */
export function HatDuzenleDialog({ hat, onClose, onDone }: { hat: TalimatHat | null; onClose: () => void; onDone: () => void }) {
  const [ad, setAd] = useState("");
  const [tur, setTur] = useState<HatTur>("montaj");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hat) {
      setAd(hat.ad);
      setTur(hat.tur);
    }
  }, [hat]);

  const kaydet = async () => {
    if (!hat) return;
    if (!ad.trim()) return void toast.error("Hat adı boş olamaz");
    setBusy(true);
    const r = await hatGuncelle(hat.hat_id, {
      ...(ad.trim() !== hat.ad ? { ad: ad.trim() } : {}),
      ...(tur !== hat.tur ? { tur } : {}),
    });
    setBusy(false);
    if (!r.success) return void toast.error(r.error);
    toast.success("Hat güncellendi");
    onDone();
    onClose();
  };

  return (
    <Dialog open={!!hat} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Hat düzenle</DialogTitle>
          <DialogDescription>Tür değişirse hattın satırlarının istasyonu da güncellenir.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Hat adı</Label>
            <Input value={ad} onChange={(e) => setAd(e.target.value)} maxLength={60} autoFocus />
          </div>
          <div>
            <Label className="mb-1 block">Tür</Label>
            <TurSecici value={tur} onChange={setTur} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button onClick={kaydet} disabled={busy} className="bg-vw-deep text-white hover:bg-vw-dark">
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

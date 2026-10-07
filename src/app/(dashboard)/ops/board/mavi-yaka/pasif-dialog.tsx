"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { talimatPasifYap } from "@/lib/talimat/actions";
import type { TalimatPasifKapsam } from "@/lib/talimat/types";

export interface PasifHedef {
  kapsam: TalimatPasifKapsam;
  ids: string[];
  baslik: string;
}

interface Props {
  planId: string;
  hedef: PasifHedef | null;
  onClose: () => void;
  onDone: () => void;
}

function bugun(): string {
  return new Date().toLocaleDateString("sv-SE");
}

/** Pasif etme: tarih aralığı (süresiz seçilirse elle aktifleştirilene dek) + neden */
export function PasifDialog({ planId, hedef, onClose, onDone }: Props) {
  const [baslangic, setBaslangic] = useState(bugun());
  const [bitis, setBitis] = useState("");
  const [suresiz, setSuresiz] = useState(false);
  const [neden, setNeden] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hedef) {
      setBaslangic(bugun());
      setBitis(bugun());
      setSuresiz(false);
      setNeden("");
    }
  }, [hedef]);

  const kaydet = async () => {
    if (!hedef) return;
    if (!suresiz && bitis && bitis < baslangic) {
      toast.error("Bitiş tarihi başlangıçtan önce olamaz");
      return;
    }
    setBusy(true);
    const r = await talimatPasifYap({
      kapsam: hedef.kapsam,
      planId,
      ids: hedef.ids,
      baslangic,
      bitis: suresiz ? null : bitis || baslangic,
      neden: neden.trim() || null,
    });
    setBusy(false);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    toast.success("Pasif edildi");
    onDone();
    onClose();
  };

  return (
    <Dialog open={!!hedef} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pasif et</DialogTitle>
          <DialogDescription>{hedef?.baslik}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Başlangıç</Label>
              <Input type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} />
            </div>
            <div>
              <Label>Bitiş</Label>
              <Input type="date" value={bitis} disabled={suresiz} min={baslangic} onChange={(e) => setBitis(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={suresiz} onCheckedChange={setSuresiz} />
            Elle aktifleştirilene kadar pasif kalsın
          </label>
          <div>
            <Label>Neden (isteğe bağlı)</Label>
            <Input value={neden} onChange={(e) => setNeden(e.target.value)} placeholder="Örn. izinli, makine arızası" maxLength={300} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button onClick={kaydet} disabled={busy} className="bg-vw-deep text-white hover:bg-vw-dark">
            Pasif et
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

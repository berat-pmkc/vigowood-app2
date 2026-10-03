"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { donusumYap, listUygunsuzItems } from "@/lib/kalite/actions";
import type { KaliteItemOption } from "@/lib/kalite/types";
import { ItemCombobox } from "./item-combobox";

interface DonusumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Kesim: uygunsuz yarı mamulü başka bir yarı mamule dönüştür */
export function DonusumDialog({ open, onOpenChange }: DonusumDialogProps) {
  const [kaynakOpts, setKaynakOpts] = useState<KaliteItemOption[]>([]);
  const [kaynak, setKaynak] = useState<KaliteItemOption | null>(null);
  const [hedef, setHedef] = useState<KaliteItemOption | null>(null);
  const [kaynakQty, setKaynakQty] = useState("");
  const [uygunQty, setUygunQty] = useState("");
  const [uygunsuzQty, setUygunsuzQty] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKaynak(null);
    setHedef(null);
    setKaynakQty("");
    setUygunQty("");
    setUygunsuzQty("");
    setLoading(true);
    listUygunsuzItems("YARI_MAMUL").then((r) => {
      setKaynakOpts(r.success ? r.data : []);
      if (!r.success) toast.error(r.error);
      setLoading(false);
    });
  }, [open]);

  const handleSubmit = async () => {
    if (!kaynak || !hedef) return toast.error("Kaynak ve hedef parçayı seçiniz");
    const kq = Number(kaynakQty) || 0;
    const uq = Number(uygunQty) || 0;
    const sq = Number(uygunsuzQty) || 0;
    if (kq <= 0) return toast.error("Tüketilen miktarı giriniz");
    if (kq > (kaynak.uygunsuz ?? 0)) return toast.error("Uygunsuz bakiye yetersiz");
    if (uq <= 0 && sq <= 0) return toast.error("Üretilen uygun veya uygunsuz miktarı giriniz");
    setSubmitting(true);
    const res = await donusumYap({
      kaynakPart: kaynak.id,
      kaynakQty: kq,
      hedefPart: hedef.id,
      uygunQty: uq,
      uygunsuzQty: sq,
    });
    setSubmitting(false);
    if (res.success) {
      toast.success("Dönüştürme kaydedildi");
      onOpenChange(false);
    } else {
      toast.error(res.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>YM Dönüştür</DialogTitle>
          <DialogDescription>
            Uygunsuz yarı mamulü keserek başka bir yarı mamule dönüştürün.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Kaynak (uygunsuz yarı mamul) *</Label>
            <ItemCombobox
              options={kaynakOpts}
              value={kaynak}
              onChange={(it) => {
                setKaynak(it);
                setKaynakQty(it ? String(it.uygunsuz ?? "") : "");
              }}
              placeholder={loading ? "Yükleniyor..." : "Uygunsuz parça seçiniz..."}
              emptyText="Uygunsuz bakiyesi olan yarı mamul yok."
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Hedef yarı mamul *</Label>
            <ItemCombobox tipi="YARI_MAMUL" value={hedef} onChange={setHedef} placeholder="Hedef parça seçiniz..." />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dn-k">
              Tüketilen kaynak adedi *
              {kaynak && <span className="font-normal text-muted-foreground"> (en fazla {kaynak.uygunsuz})</span>}
            </Label>
            <Input
              id="dn-k"
              type="number"
              inputMode="numeric"
              min={1}
              value={kaynakQty}
              onChange={(e) => setKaynakQty(e.target.value)}
              className="h-12 text-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="dn-u">Üretilen uygun</Label>
              <Input
                id="dn-u"
                type="number"
                inputMode="numeric"
                min={0}
                value={uygunQty}
                onChange={(e) => setUygunQty(e.target.value)}
                className="h-12 text-lg"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dn-s">Üretilen uygunsuz</Label>
              <Input
                id="dn-s"
                type="number"
                inputMode="numeric"
                min={0}
                value={uygunsuzQty}
                onChange={(e) => setUygunsuzQty(e.target.value)}
                className="h-12 text-lg"
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" className="h-12 px-5" onClick={() => onOpenChange(false)} disabled={submitting}>
              Vazgeç
            </Button>
            <Button
              className="h-12 bg-[#70c1aa] px-6 text-white hover:bg-[#70c1aa]/90"
              onClick={handleSubmit}
              disabled={submitting || !kaynak || !hedef}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Dönüştür
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
